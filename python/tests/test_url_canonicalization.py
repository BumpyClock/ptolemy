"""
Test URL canonicalization in source ID generation.

This test ensures that URLs are properly normalized before hashing
to prevent duplicate sources from URL variations.
"""

import pytest
from src.server.services.crawling.helpers.url_handler import URLHandler


class TestURLCanonicalization:
    """Test that URL canonicalization works correctly for source ID generation."""

    def test_trailing_slash_normalization(self):
        """Test that trailing slashes are handled consistently."""
        handler = URLHandler()
        
        # These should generate the same ID
        url1 = "https://example.com/path"
        url2 = "https://example.com/path/"
        
        id1 = handler.generate_unique_source_id(url1)
        id2 = handler.generate_unique_source_id(url2)
        
        assert id1 == id2, "URLs with/without trailing slash should generate same ID"
        
        # Root path should keep its slash
        root1 = "https://example.com"
        root2 = "https://example.com/"
        
        root_id1 = handler.generate_unique_source_id(root1)
        root_id2 = handler.generate_unique_source_id(root2)
        
        # These should be the same (both normalize to https://example.com/)
        assert root_id1 == root_id2, "Root URLs should normalize consistently"

    def test_fragment_removal(self):
        """Test that URL fragments are removed."""
        handler = URLHandler()
        
        urls = [
            "https://example.com/page",
            "https://example.com/page#section1",
            "https://example.com/page#section2",
            "https://example.com/page#",
        ]
        
        ids = [handler.generate_unique_source_id(url) for url in urls]
        
        # All should generate the same ID
        assert len(set(ids)) == 1, "URLs with different fragments should generate same ID"

    def test_tracking_param_removal(self):
        """Test that tracking parameters are removed."""
        handler = URLHandler()
        
        # URL without tracking params
        clean_url = "https://example.com/page?important=value"
        
        # URLs with various tracking params
        tracked_urls = [
            "https://example.com/page?important=value&utm_source=google",
            "https://example.com/page?utm_medium=email&important=value",
            "https://example.com/page?important=value&fbclid=abc123",
            "https://example.com/page?gclid=xyz&important=value&utm_campaign=test",
            "https://example.com/page?important=value&ref=homepage",
            "https://example.com/page?source=newsletter&important=value",
        ]
        
        clean_id = handler.generate_unique_source_id(clean_url)
        tracked_ids = [handler.generate_unique_source_id(url) for url in tracked_urls]
        
        # All tracked URLs should generate the same ID as the clean URL
        for tracked_id in tracked_ids:
            assert tracked_id == clean_id, "URLs with tracking params should match clean URL"

    def test_query_param_sorting(self):
        """Test that query parameters are sorted for consistency."""
        handler = URLHandler()
        
        urls = [
            "https://example.com/page?a=1&b=2&c=3",
            "https://example.com/page?c=3&a=1&b=2",
            "https://example.com/page?b=2&c=3&a=1",
        ]
        
        ids = [handler.generate_unique_source_id(url) for url in urls]
        
        # All should generate the same ID
        assert len(set(ids)) == 1, "URLs with reordered query params should generate same ID"

    def test_default_port_removal(self):
        """Test that default ports are removed."""
        handler = URLHandler()
        
        # HTTP default port (80)
        http_urls = [
            "http://example.com/page",
            "http://example.com:80/page",
        ]
        
        http_ids = [handler.generate_unique_source_id(url) for url in http_urls]
        assert len(set(http_ids)) == 1, "HTTP URLs with/without :80 should generate same ID"
        
        # HTTPS default port (443)
        https_urls = [
            "https://example.com/page",
            "https://example.com:443/page",
        ]
        
        https_ids = [handler.generate_unique_source_id(url) for url in https_urls]
        assert len(set(https_ids)) == 1, "HTTPS URLs with/without :443 should generate same ID"
        
        # Non-default ports should be preserved
        url1 = "https://example.com:8080/page"
        url2 = "https://example.com:9090/page"
        
        id1 = handler.generate_unique_source_id(url1)
        id2 = handler.generate_unique_source_id(url2)
        
        assert id1 != id2, "URLs with different non-default ports should generate different IDs"

    def test_case_normalization(self):
        """Test that scheme and domain are lowercased."""
        handler = URLHandler()
        
        urls = [
            "https://example.com/Path/To/Page",
            "HTTPS://EXAMPLE.COM/Path/To/Page",
            "https://Example.Com/Path/To/Page",
            "HTTPs://example.COM/Path/To/Page",
        ]
        
        ids = [handler.generate_unique_source_id(url) for url in urls]
        
        # All should generate the same ID (path case is preserved)
        assert len(set(ids)) == 1, "URLs with different case in scheme/domain should generate same ID"
        
        # But different paths should generate different IDs
        path_urls = [
            "https://example.com/path",
            "https://example.com/Path",
            "https://example.com/PATH",
        ]
        
        path_ids = [handler.generate_unique_source_id(url) for url in path_urls]
        
        # These should be different (path case matters)
        assert len(set(path_ids)) == 3, "URLs with different path case should generate different IDs"

    def test_complex_canonicalization(self):
        """Test complex URL with multiple normalizations needed."""
        handler = URLHandler()
        
        urls = [
            "https://example.com/page",
            "HTTPS://EXAMPLE.COM:443/page/",
            "https://Example.com/page#section",
            "https://example.com/page/?utm_source=test",
            "https://example.com:443/page?utm_campaign=abc#footer",
        ]
        
        ids = [handler.generate_unique_source_id(url) for url in urls]
        
        # All should generate the same ID
        assert len(set(ids)) == 1, "Complex URLs should normalize to same ID"

    def test_edge_cases(self):
        """Test edge cases and error handling."""
        handler = URLHandler()
        
        # Empty URL
        empty_id = handler.generate_unique_source_id("")
        assert len(empty_id) == 16, "Empty URL should still generate valid ID"
        
        # Invalid URL
        invalid_id = handler.generate_unique_source_id("not-a-url")
        assert len(invalid_id) == 16, "Invalid URL should still generate valid ID"
        
        # URL with special characters
        special_url = "https://example.com/page?key=value%20with%20spaces"
        special_id = handler.generate_unique_source_id(special_url)
        assert len(special_id) == 16, "URL with encoded chars should generate valid ID"
        
        # Very long URL
        long_url = "https://example.com/" + "a" * 1000
        long_id = handler.generate_unique_source_id(long_url)
        assert len(long_id) == 16, "Long URL should generate valid ID"

    def test_preserves_important_params(self):
        """Test that non-tracking params are preserved."""
        handler = URLHandler()
        
        # These have different important params, should be different
        url1 = "https://api.example.com/v1/users?page=1"
        url2 = "https://api.example.com/v1/users?page=2"
        
        id1 = handler.generate_unique_source_id(url1)
        id2 = handler.generate_unique_source_id(url2)
        
        assert id1 != id2, "URLs with different important params should generate different IDs"
        
        # But tracking params should still be removed
        url3 = "https://api.example.com/v1/users?page=1&utm_source=docs"
        id3 = handler.generate_unique_source_id(url3)
        
        assert id3 == id1, "Adding tracking params shouldn't change ID"

    def test_local_file_paths(self):
        """Test handling of local file paths."""
        handler = URLHandler()
        
        # File URLs
        file_url = "file:///Users/test/document.pdf"
        file_id = handler.generate_unique_source_id(file_url)
        assert len(file_id) == 16, "File URL should generate valid ID"
        
        # Relative paths
        relative_path = "../documents/file.txt"
        relative_id = handler.generate_unique_source_id(relative_path)
        assert len(relative_id) == 16, "Relative path should generate valid ID"


class TestCanonicalizeUrl:
    """Test the canonicalize_url function directly."""

    def test_basic_normalization(self):
        """Test basic URL normalization."""
        result = URLHandler.canonicalize_url("HTTPS://Example.COM:443/path/?b=2&a=1")
        assert result == "https://example.com/path?a=1&b=2"

    def test_tracking_params_removed(self):
        """Test that tracking parameters are removed."""
        result = URLHandler.canonicalize_url(
            "https://example.com/page?keep=yes&utm_source=google&utm_campaign=test"
        )
        assert result == "https://example.com/page?keep=yes"

    def test_fragment_dropped_by_default(self):
        """Test that fragments are dropped by default."""
        result = URLHandler.canonicalize_url("https://example.com/page#section")
        assert result == "https://example.com/page"

    def test_fragment_preserved_when_requested(self):
        """Test that fragments can be preserved."""
        result = URLHandler.canonicalize_url(
            "https://example.com/page#section", preserve_fragment=True
        )
        assert result == "https://example.com/page#section"

    def test_trailing_slash_removed(self):
        """Test trailing slash handling."""
        result = URLHandler.canonicalize_url("https://example.com/path/")
        assert result == "https://example.com/path"

        # Root path keeps slash
        result = URLHandler.canonicalize_url("https://example.com/")
        assert result == "https://example.com/"

    def test_default_port_removed(self):
        """Test default port removal."""
        result = URLHandler.canonicalize_url("http://example.com:80/page")
        assert result == "http://example.com/page"

        result = URLHandler.canonicalize_url("https://example.com:443/page")
        assert result == "https://example.com/page"

        # Non-default port kept
        result = URLHandler.canonicalize_url("https://example.com:8080/page")
        assert result == "https://example.com:8080/page"


class TestCanonicalizePageUrl:
    """Test the canonicalize_page_url function for page deduplication."""

    def test_regular_url_drops_fragment(self):
        """Test that regular URLs drop fragments."""
        result = URLHandler.canonicalize_page_url("https://docs.com/guide#section")
        assert result == "https://docs.com/guide"

    def test_llms_full_preserves_fragment(self):
        """Test that llms-full.txt URLs preserve fragments."""
        result = URLHandler.canonicalize_page_url(
            "https://docs.com/llms-full.txt#Authentication"
        )
        assert result == "https://docs.com/llms-full.txt#Authentication"

    def test_llms_txt_preserves_fragment(self):
        """Test that llms.txt URLs preserve fragments."""
        result = URLHandler.canonicalize_page_url("https://docs.com/llms.txt#API")
        assert result == "https://docs.com/llms.txt#API"

    def test_llms_directory_file_preserves_fragment(self):
        """Test that files in /llms/ directory preserve fragments."""
        result = URLHandler.canonicalize_page_url(
            "https://docs.com/llms/guides.txt#Getting-Started"
        )
        assert result == "https://docs.com/llms/guides.txt#Getting-Started"

    def test_llms_full_without_fragment(self):
        """Test llms-full URL without fragment."""
        result = URLHandler.canonicalize_page_url("https://docs.com/llms-full.txt")
        assert result == "https://docs.com/llms-full.txt"

    def test_llms_full_with_tracking_params(self):
        """Test llms-full URL with tracking params removed but fragment kept."""
        result = URLHandler.canonicalize_page_url(
            "https://docs.com/llms-full.txt?utm_source=test#Auth"
        )
        assert result == "https://docs.com/llms-full.txt#Auth"

    def test_case_insensitive_llms_detection(self):
        """Test that llms detection is case-insensitive."""
        # llms-full.txt detection should be case-insensitive
        result = URLHandler.canonicalize_page_url(
            "https://DOCS.COM/LLMS-FULL.TXT#Section"
        )
        # URL gets lowercased, fragment preserved
        assert result == "https://docs.com/LLMS-FULL.TXT#Section"