-- Add deferred code summary setting
INSERT INTO ptolemy_settings (key, value, is_encrypted, category, description) VALUES
('DEFER_CODE_SUMMARIES', 'false', false, 'code_extraction', 'Store code examples immediately and generate summaries after ingestion')
ON CONFLICT (key) DO NOTHING;
