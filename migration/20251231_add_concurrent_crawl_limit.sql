-- Add server-level concurrent crawl limit setting for existing installations
INSERT INTO ptolemy_settings (key, value, is_encrypted, category, description) VALUES
('CONCURRENT_CRAWL_LIMIT', '3', false, 'rag_strategy', 'Maximum concurrent crawl operations across the server (1-10)')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description;
