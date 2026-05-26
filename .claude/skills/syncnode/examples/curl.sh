#!/usr/bin/env bash
# SyncNode — every public endpoint as a working cURL command.
# Replace API_KEY, ACCESS_TOKEN, and any sample model/prompt values before running.

API_KEY="your-api-key-from-syncnode.ai/api_keys"
ACCESS_TOKEN="your-syncnode-access-token"
BASE="https://run.syncnode.ai"

# -------- Balance (public, no Bearer) --------
curl "$BASE/balance?apiKey=$API_KEY"

# -------- Chat completion via OpenRouter (synchronous) --------
curl -X POST "$BASE/chat-completion" \
  -H "Content-Type: application/json" \
  -d "{
    \"apiKey\": \"$API_KEY\",
    \"model\": \"openai/gpt-4o-mini\",
    \"messages\": [{\"role\": \"user\", \"content\": \"Tell me a joke about cats.\"}],
    \"max_tokens\": 200,
    \"temperature\": 0.7
  }"

# -------- Chat completion via OpenAI direct (synchronous) --------
curl -X POST "$BASE/chatgpt-completion" \
  -H "Content-Type: application/json" \
  -d "{
    \"apiKey\": \"$API_KEY\",
    \"model\": \"gpt-4o-mini\",
    \"messages\": [{\"role\": \"user\", \"content\": \"Summarize quantum entanglement in one sentence.\"}]
  }"

# -------- Image generation via Replicate (async) --------
SUBMIT=$(curl -s -X POST "$BASE/generate" \
  -H "Content-Type: application/json" \
  -d "{
    \"apiKey\": \"$API_KEY\",
    \"model\": \"bytedance/seedance-1-lite\",
    \"input\": {
      \"prompt\": \"A cat riding a bike\",
      \"width\": 768,
      \"height\": 768,
      \"num_outputs\": 1
    }
  }")
echo "$SUBMIT"
JOB_ID=$(echo "$SUBMIT" | grep -o '"job_id":"[^"]*"' | cut -d'"' -f4)

# Poll status
curl "$BASE/prediction-status?job_id=$JOB_ID"

# -------- Image generation via FAL (async) --------
FAL_SUBMIT=$(curl -s -X POST "$BASE/fal/generate" \
  -H "Content-Type: application/json" \
  -d "{
    \"apiKey\": \"$API_KEY\",
    \"model\": \"fal-ai/recraft/v4.1/text-to-image\",
    \"input\": {
      \"prompt\": \"Tilt-shift miniature of a Portuguese fishing village at golden hour\",
      \"image_size\": \"landscape_16_9\",
      \"enable_safety_checker\": true
    }
  }")
echo "$FAL_SUBMIT"
FAL_JOB=$(echo "$FAL_SUBMIT" | grep -o '"job_id":"[^"]*"' | cut -d'"' -f4)

curl "$BASE/fal/status?job_id=$FAL_JOB"

# -------- Image via Alibaba DashScope (Wan Image Pro) --------
curl -X POST "$BASE/alibaba/generate" \
  -H "Content-Type: application/json" \
  -d "{
    \"apiKey\": \"$API_KEY\",
    \"model\": \"wan2.7-image-pro\",
    \"input\": {
      \"messages\": [{
        \"role\": \"user\",
        \"content\": [{\"text\": \"A futuristic cyberpunk city at night, neon lights, rain\"}]
      }]
    },
    \"parameters\": {\"size\": \"2K\", \"n\": 1, \"watermark\": false}
  }"

# -------- Video via Alibaba DashScope (Wan i2v, async) --------
curl -X POST "$BASE/alibaba/generate" \
  -H "Content-Type: application/json" \
  -d "{
    \"apiKey\": \"$API_KEY\",
    \"model\": \"wan2.7-i2v\",
    \"input\": {
      \"prompt\": \"A cat surfing on a wave\",
      \"media\": [{\"type\": \"first_frame\", \"url\": \"https://example.com/first.jpg\"}]
    },
    \"parameters\": {\"resolution\": \"1080P\", \"duration\": 5, \"prompt_extend\": true}
  }"
# then: curl "$BASE/alibaba/status?job_id=..."

# -------- Face swap (async) --------
curl -X POST "$BASE/face-swap/run" \
  -H "Content-Type: application/json" \
  -d "{
    \"apiKey\": \"$API_KEY\",
    \"source_image\": \"https://example.com/source.jpg\",
    \"target_image\": \"https://example.com/target.jpg\"
  }"
# then: curl "$BASE/face-swap/status?job_id=..."

# -------- Content moderation (public, no Bearer) --------
curl -X POST "https://moderate.syncnode.ai/?apiKey=$API_KEY&what=moderation" \
  -H "Content-Type: application/json" \
  -d "{
    \"apiKey\": \"$API_KEY\",
    \"text\": \"Check this sentence for safety.\",
    \"imageUrl\": \"https://example.com/photo.jpg\"
  }"

# -------- List recent tasks (Bearer required) --------
curl "$BASE/tasks?apiKey=$API_KEY&page=1&size=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
