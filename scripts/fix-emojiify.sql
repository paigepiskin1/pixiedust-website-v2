UPDATE templates SET
  input_json = '{"prompt":"Turn this into an emoji style illustration","input_image":"{{file}}","aspect_ratio":"match_input_image","output_format":"webp"}'
WHERE id = 'old-emojiify';
