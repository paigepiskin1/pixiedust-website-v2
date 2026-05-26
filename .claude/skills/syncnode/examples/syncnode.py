"""Minimal SyncNode client for Python (3.8+). One dependency: `requests`.

Usage:
    from syncnode import SyncNode
    sn = SyncNode(api_key=os.environ["SYNCNODE_API_KEY"])
    print(sn.balance())

    # Synchronous chat
    r = sn.chat(model="openai/gpt-4o-mini", messages=[{"role": "user", "content": "hi"}])
    print(r["choices"][0]["message"]["content"])

    # Async image gen
    job = sn.fal(model="fal-ai/recraft/v4.1/text-to-image",
                 input={"prompt": "a cat riding a bike", "image_size": "square"})
    result = sn.wait_for_completion(sn.fal_status, job["job_id"])
    print(result["output"])
"""

import time
from typing import Any, Callable, Optional

import requests

BASE = "https://run.syncnode.ai"
MODERATE_BASE = "https://moderate.syncnode.ai"


class SyncNodeError(RuntimeError):
    pass


class SyncNode:
    def __init__(self, api_key: Optional[str] = None, access_token: Optional[str] = None, uid: Optional[str] = None):
        # Accept either `api_key` (preferred) or `uid` (legacy alias) for the constructor
        key = api_key or uid
        if not key:
            raise ValueError("api_key is required")
        self.api_key = key
        self.access_token = access_token

    # ---- internal ----

    def _post(self, path: str, body: dict, needs_auth: bool = False) -> dict:
        headers = {"Content-Type": "application/json"}
        if needs_auth:
            if not self.access_token:
                raise SyncNodeError(f"{path} requires access_token")
            headers["Authorization"] = f"Bearer {self.access_token}"
        payload = {"apiKey": self.api_key, **body}
        r = requests.post(f"{BASE}{path}", json=payload, headers=headers, timeout=60)
        try:
            data = r.json()
        except ValueError:
            data = {"raw": r.text}
        if not r.ok or (isinstance(data, dict) and data.get("error")):
            raise SyncNodeError(data.get("error") if isinstance(data, dict) else f"HTTP {r.status_code}")
        return data

    def _get(self, path: str, params: Optional[dict] = None, needs_auth: bool = False) -> dict:
        params = {"apiKey": self.api_key, **(params or {})}
        headers = {}
        if needs_auth:
            if not self.access_token:
                raise SyncNodeError(f"{path} requires access_token")
            headers["Authorization"] = f"Bearer {self.access_token}"
        r = requests.get(f"{BASE}{path}", params=params, headers=headers, timeout=60)
        data = r.json()
        if not r.ok or (isinstance(data, dict) and data.get("error")):
            raise SyncNodeError(data.get("error") if isinstance(data, dict) else f"HTTP {r.status_code}")
        return data

    # ---- synchronous endpoints ----

    def balance(self) -> dict:
        return self._get("/balance")

    def chat(self, **kwargs) -> dict:           # OpenRouter
        return self._post("/chat-completion", kwargs)

    def chatgpt(self, **kwargs) -> dict:        # OpenAI direct
        return self._post("/chatgpt-completion", kwargs)

    # ---- async submit endpoints ----

    def generate(self, **kwargs) -> dict:       # Replicate
        return self._post("/generate", kwargs)

    def fal(self, **kwargs) -> dict:            # FAL
        return self._post("/fal/generate", kwargs)

    def alibaba(self, **kwargs) -> dict:        # DashScope
        return self._post("/alibaba/generate", kwargs)

    def face_swap(self, **kwargs) -> dict:
        return self._post("/face-swap/run", kwargs)

    # ---- async status endpoints ----

    def prediction_status(self, job_id: str) -> dict:
        return self._get("/prediction-status", {"job_id": job_id})

    def fal_status(self, job_id: str) -> dict:
        return self._get("/fal/status", {"job_id": job_id})

    def alibaba_status(self, job_id: str) -> dict:
        return self._get("/alibaba/status", {"job_id": job_id})

    def face_swap_status(self, job_id: str) -> dict:
        return self._get("/face-swap/status", {"job_id": job_id})

    # ---- auth-required endpoints ----

    def tasks(self, page: int = 1, size: int = 10) -> dict:
        return self._get("/tasks", {"page": page, "size": size}, needs_auth=True)

    # ---- moderation (different base) ----

    def moderate(self, **body) -> dict:
        params = {"apiKey": self.api_key, "what": "moderation"}
        r = requests.post(MODERATE_BASE, params=params, json={"apiKey": self.api_key, **body}, timeout=30)
        if not r.ok:
            raise SyncNodeError(f"Moderation failed: HTTP {r.status_code}")
        return r.json()

    # ---- helper: block until an async job finishes ----

    def wait_for_completion(
        self,
        status_fn: Callable[[str], dict],
        job_id: str,
        interval: float = 2.0,
        timeout: float = 5 * 60,
    ) -> dict:
        deadline = time.time() + timeout
        while time.time() < deadline:
            s = status_fn(job_id)
            rep = (s.get("replicate_status") or "").lower()
            task = (s.get("task_status") or "").upper()
            if rep in ("completed", "succeeded") or task in ("COMPLETED", "SUCCEEDED"):
                return s
            if rep == "failed" or task in ("FAILED", "CANCELED"):
                raise SyncNodeError(f"Task failed: {s.get('output') or 'unknown'}")
            time.sleep(interval)
        raise SyncNodeError(f"Timed out waiting for job {job_id}")


if __name__ == "__main__":
    import os
    sn = SyncNode(api_key=os.environ["SYNCNODE_API_KEY"])

    submit = sn.fal(
        model="fal-ai/recraft/v4.1/text-to-image",
        input={
            "prompt": "Tilt-shift miniature of a Portuguese fishing village at golden hour",
            "image_size": "landscape_16_9",
        },
    )
    print("Submitted:", submit["job_id"])

    result = sn.wait_for_completion(sn.fal_status, submit["job_id"])
    print("Done:", result["output"])
