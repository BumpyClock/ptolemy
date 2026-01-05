import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Loader, ChevronDown, ChevronUp, Zap, Database, Cog } from 'lucide-react';
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { SelectField } from "@/components/ui/SelectField";
import { Separator } from "@/components/ui/Separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";
import { LuBrainCircuit } from 'react-icons/lu';
import { PiDatabaseThin } from 'react-icons/pi';
import { useToast } from '../../features/shared/hooks/useToast';
import { credentialsService } from '../../services/credentialsService';
import OllamaModelDiscoveryModal from './OllamaModelDiscoveryModal';
import OllamaModelSelectionModal from './OllamaModelSelectionModal';

type ProviderKey = 'openai' | 'google' | 'ollama' | 'anthropic' | 'grok' | 'openrouter';

// Providers that support embedding models
const EMBEDDING_CAPABLE_PROVIDERS: ProviderKey[] = ['openai', 'google', 'openrouter', 'ollama'];

interface ProviderModels {
  chatModel: string;
  embeddingModel: string;
}

type ProviderModelMap = Record<ProviderKey, ProviderModels>;

// Provider model persistence helpers
const PROVIDER_MODELS_KEY = 'ptolemy_provider_models';

const getDefaultModels = (provider: ProviderKey): ProviderModels => {
  const chatDefaults: Record<ProviderKey, string> = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-sonnet-20241022',
    google: 'gemini-1.5-flash',
    grok: 'grok-3-mini', // Updated to use grok-3-mini as default
    openrouter: 'openai/gpt-4o-mini',
    ollama: 'llama3:8b'
  };

  const embeddingDefaults: Record<ProviderKey, string> = {
    openai: 'text-embedding-3-small',
    anthropic: 'text-embedding-3-small', // Fallback to OpenAI
    google: 'text-embedding-004',
    grok: 'text-embedding-3-small', // Fallback to OpenAI
    openrouter: 'openai/text-embedding-3-small', // MUST include provider prefix for OpenRouter
    ollama: 'nomic-embed-text'
  };

  return {
    chatModel: chatDefaults[provider],
    embeddingModel: embeddingDefaults[provider]
  };
};

const saveProviderModels = (providerModels: ProviderModelMap): void => {
  try {
    localStorage.setItem(PROVIDER_MODELS_KEY, JSON.stringify(providerModels));
  } catch (error) {
    console.error('Failed to save provider models:', error);
  }
};

const loadProviderModels = (): ProviderModelMap => {
  try {
    const saved = localStorage.getItem(PROVIDER_MODELS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load provider models:', error);
  }

  // Return defaults for all providers if nothing saved
  const providers: ProviderKey[] = ['openai', 'google', 'openrouter', 'ollama', 'anthropic', 'grok'];
  const defaultModels: ProviderModelMap = {} as ProviderModelMap;

  providers.forEach(provider => {
    defaultModels[provider] = getDefaultModels(provider);
  });

  return defaultModels;
};

// Static color styles mapping (prevents Tailwind JIT purging)
const colorStyles: Record<ProviderKey, string> = {
  openai: 'border-border bg-muted',
  google: 'border-border bg-muted',
  openrouter: 'border-border bg-muted',
  ollama: 'border-border bg-muted',
  anthropic: 'border-border bg-muted',
  grok: 'border-border bg-muted',
};

const providerWarningAlertStyle = 'border-border bg-muted text-muted-foreground';
const providerErrorAlertStyle = 'border-destructive/30 bg-destructive/10 text-destructive';
const providerMissingAlertStyle = providerErrorAlertStyle;

const providerDisplayNames: Record<ProviderKey, string> = {
  openai: 'OpenAI',
  google: 'Google',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  anthropic: 'Anthropic',
  grok: 'Grok',
};

const isProviderKey = (value: unknown): value is ProviderKey =>
  typeof value === 'string' && ['openai', 'google', 'openrouter', 'ollama', 'anthropic', 'grok'].includes(value);

// Default base URL for Ollama instances when not explicitly configured
const DEFAULT_OLLAMA_URL = 'http://host.docker.internal:11434/v1';

const PROVIDER_CREDENTIAL_KEYS = [
  'OPENAI_API_KEY',
  'GOOGLE_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENROUTER_API_KEY',
  'GROK_API_KEY',
] as const;

type ProviderCredentialKey = typeof PROVIDER_CREDENTIAL_KEYS[number];

const CREDENTIAL_PROVIDER_MAP: Record<ProviderCredentialKey, ProviderKey> = {
  OPENAI_API_KEY: 'openai',
  GOOGLE_API_KEY: 'google',
  ANTHROPIC_API_KEY: 'anthropic',
  OPENROUTER_API_KEY: 'openrouter',
  GROK_API_KEY: 'grok',
};

const normalizeBaseUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  let normalized = trimmed.replace(/\/+$/, '');
  normalized = normalized.replace(/\/v1$/i, '');
  return normalized || null;
};

interface RAGSettingsProps {
  ragSettings: {
    MODEL_CHOICE: string;
    USE_CONTEXTUAL_EMBEDDINGS: boolean;
    CONTEXTUAL_EMBEDDINGS_MAX_WORKERS: number;
    USE_HYBRID_SEARCH: boolean;
    USE_AGENTIC_RAG: boolean;
    USE_RERANKING: boolean;
    USE_LLM_ROUTER: boolean;
    LLM_PROVIDER?: string;
    LLM_BASE_URL?: string;
    LLM_INSTANCE_NAME?: string;
    EMBEDDING_MODEL?: string;
    EMBEDDING_PROVIDER?: string;
    OLLAMA_EMBEDDING_URL?: string;
    OLLAMA_EMBEDDING_INSTANCE_NAME?: string;
    // Crawling Performance Settings
    CRAWL_BATCH_SIZE?: number;
    CRAWL_MAX_CONCURRENT?: number;
    CONCURRENT_CRAWL_LIMIT?: number;
    CRAWL_WAIT_STRATEGY?: string;
    CRAWL_PAGE_TIMEOUT?: number;
    CRAWL_DELAY_BEFORE_HTML?: number;
    // Storage Performance Settings
    DOCUMENT_STORAGE_BATCH_SIZE?: number;
    EMBEDDING_BATCH_SIZE?: number;
    DELETE_BATCH_SIZE?: number;
    ENABLE_PARALLEL_BATCHES?: boolean;
    // Advanced Settings
    MEMORY_THRESHOLD_PERCENT?: number;
    DISPATCHER_CHECK_INTERVAL?: number;
    CODE_EXTRACTION_BATCH_SIZE?: number;
    CODE_SUMMARY_MAX_WORKERS?: number;
  };
  setRagSettings: (settings: any) => void;
}

export const RAGSettings = ({
  ragSettings,
  setRagSettings
}: RAGSettingsProps) => {
  const [saving, setSaving] = useState(false);
  const [showCrawlingSettings, setShowCrawlingSettings] = useState(false);
  const [showStorageSettings, setShowStorageSettings] = useState(false);
  const [showModelDiscoveryModal, setShowModelDiscoveryModal] = useState(false);
  const [showOllamaConfig, setShowOllamaConfig] = useState(false);
  
  // Edit modals state
  const [showEditLLMModal, setShowEditLLMModal] = useState(false);
  const [showEditEmbeddingModal, setShowEditEmbeddingModal] = useState(false);
  
  // Model selection modals state
  const [showLLMModelSelectionModal, setShowLLMModelSelectionModal] = useState(false);
  const [showEmbeddingModelSelectionModal, setShowEmbeddingModelSelectionModal] = useState(false);

  // Provider-specific model persistence state
  const [providerModels, setProviderModels] = useState<ProviderModelMap>(() => loadProviderModels());

  // Independent provider selection state
  const [chatProvider, setChatProvider] = useState<ProviderKey>(() =>
    (ragSettings.LLM_PROVIDER as ProviderKey) || 'openai'
  );
  const [embeddingProvider, setEmbeddingProvider] = useState<ProviderKey>(() =>
    // Default to openai if no specific embedding provider is set
    (ragSettings.EMBEDDING_PROVIDER as ProviderKey) || 'openai'
  );
  const [activeSelection, setActiveSelection] = useState<'chat' | 'embedding'>('chat');

  // Instance configurations
  const [llmInstanceConfig, setLLMInstanceConfig] = useState({
    name: '',
    url: ragSettings.LLM_BASE_URL || 'http://host.docker.internal:11434/v1'
  });
  const [embeddingInstanceConfig, setEmbeddingInstanceConfig] = useState({
    name: '', 
    url: ragSettings.OLLAMA_EMBEDDING_URL || 'http://host.docker.internal:11434/v1'
  });

  // Update instance configs when ragSettings change (after loading from database)
  // Use refs to prevent infinite loops
  const lastLLMConfigRef = useRef({ url: '', name: '' });
  const lastEmbeddingConfigRef = useRef({ url: '', name: '' });
  
  useEffect(() => {
    const newLLMUrl = ragSettings.LLM_BASE_URL || '';
    const newLLMName = ragSettings.LLM_INSTANCE_NAME || '';
    
    if (newLLMUrl !== lastLLMConfigRef.current.url || newLLMName !== lastLLMConfigRef.current.name) {
      lastLLMConfigRef.current = { url: newLLMUrl, name: newLLMName };
      setLLMInstanceConfig(prev => {
        const newConfig = {
          url: newLLMUrl || prev.url,
          name: newLLMName || prev.name
        };
        // Only update if actually different to prevent loops
        if (newConfig.url !== prev.url || newConfig.name !== prev.name) {
          return newConfig;
        }
        return prev;
      });
    }
  }, [ragSettings.LLM_BASE_URL, ragSettings.LLM_INSTANCE_NAME]);

  useEffect(() => {
    const newEmbeddingUrl = ragSettings.OLLAMA_EMBEDDING_URL || '';
    const newEmbeddingName = ragSettings.OLLAMA_EMBEDDING_INSTANCE_NAME || '';
    
    if (newEmbeddingUrl !== lastEmbeddingConfigRef.current.url || newEmbeddingName !== lastEmbeddingConfigRef.current.name) {
      lastEmbeddingConfigRef.current = { url: newEmbeddingUrl, name: newEmbeddingName };
      setEmbeddingInstanceConfig(prev => {
        const newConfig = {
          url: newEmbeddingUrl || prev.url,
          name: newEmbeddingName || prev.name
        };
        // Only update if actually different to prevent loops
        if (newConfig.url !== prev.url || newConfig.name !== prev.name) {
          return newConfig;
        }
        return prev;
      });
    }
  }, [ragSettings.OLLAMA_EMBEDDING_URL, ragSettings.OLLAMA_EMBEDDING_INSTANCE_NAME]);

  // Provider model persistence effects - separate for chat and embedding
  useEffect(() => {
    // Update chat provider models when chat model changes
    if (chatProvider && ragSettings.MODEL_CHOICE) {
      setProviderModels(prev => {
        const updated = {
          ...prev,
          [chatProvider]: {
            ...prev[chatProvider],
            chatModel: ragSettings.MODEL_CHOICE
          }
        };
        saveProviderModels(updated);
        return updated;
      });
    }
  }, [ragSettings.MODEL_CHOICE, chatProvider]);

  useEffect(() => {
    // Update embedding provider models when embedding model changes
    if (embeddingProvider && ragSettings.EMBEDDING_MODEL) {
      setProviderModels(prev => {
        const updated = {
          ...prev,
          [embeddingProvider]: {
            ...prev[embeddingProvider],
            embeddingModel: ragSettings.EMBEDDING_MODEL
          }
        };
        saveProviderModels(updated);
        return updated;
      });
    }
  }, [ragSettings.EMBEDDING_MODEL, embeddingProvider]);

  const hasLoadedCredentialsRef = useRef(false);

  const reloadApiCredentials = useCallback(async () => {
    try {
      const statusResults = await credentialsService.checkCredentialStatus(
        Array.from(PROVIDER_CREDENTIAL_KEYS),
      );

      const credentials: { [key: string]: boolean } = {};

      for (const key of PROVIDER_CREDENTIAL_KEYS) {
        const result = statusResults[key];
        credentials[key] = !!result?.has_value;
      }

      console.log(
        '🔑 Updated API credential status snapshot:',
        Object.keys(credentials),
      );
      setApiCredentials(credentials);
      hasLoadedCredentialsRef.current = true;
    } catch (error) {
      console.error('Failed to load API credentials for status checking:', error);
    }
  }, []);

  useEffect(() => {
    void reloadApiCredentials();
  }, [reloadApiCredentials]);

  useEffect(() => {
    if (!hasLoadedCredentialsRef.current) {
      return;
    }

    void reloadApiCredentials();
  }, [ragSettings.LLM_PROVIDER, reloadApiCredentials]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Object.keys(ragSettings).length > 0) {
        void reloadApiCredentials();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [ragSettings.LLM_PROVIDER, reloadApiCredentials]);

  useEffect(() => {
    const needsDetection = chatProvider === 'ollama' || embeddingProvider === 'ollama';

    if (!needsDetection) {
      setOllamaServerStatus('unknown');
      return;
    }

    const baseUrl = (
      ragSettings.LLM_BASE_URL?.trim() ||
      llmInstanceConfig.url?.trim() ||
      ragSettings.OLLAMA_EMBEDDING_URL?.trim() ||
      embeddingInstanceConfig.url?.trim() ||
      DEFAULT_OLLAMA_URL
    );

    const normalizedUrl = baseUrl.replace('/v1', '').replace(/\/$/, '');

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(
          `/api/ollama/instances/health?instance_urls=${encodeURIComponent(normalizedUrl)}`,
          { method: 'GET', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
        );

        if (cancelled) return;

        if (!response.ok) {
          setOllamaServerStatus('offline');
          return;
        }

        const data = await response.json();
        const instanceStatus = data.instance_status?.[normalizedUrl];
        setOllamaServerStatus(instanceStatus?.is_healthy ? 'online' : 'offline');
      } catch (error) {
        if (!cancelled) {
          setOllamaServerStatus('offline');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chatProvider, embeddingProvider, ragSettings.LLM_BASE_URL, ragSettings.OLLAMA_EMBEDDING_URL, llmInstanceConfig.url, embeddingInstanceConfig.url]);

  // Sync independent provider states with ragSettings (one-way: ragSettings -> local state)
  useEffect(() => {
    if (ragSettings.LLM_PROVIDER && ragSettings.LLM_PROVIDER !== chatProvider) {
      setChatProvider(ragSettings.LLM_PROVIDER as ProviderKey);
    }
  }, [ragSettings.LLM_PROVIDER]); // Remove chatProvider dependency to avoid loops

  useEffect(() => {
    if (ragSettings.EMBEDDING_PROVIDER && ragSettings.EMBEDDING_PROVIDER !== embeddingProvider) {
      setEmbeddingProvider(ragSettings.EMBEDDING_PROVIDER as ProviderKey);
    }
  }, [ragSettings.EMBEDDING_PROVIDER]); // Remove embeddingProvider dependency to avoid loops

  useEffect(() => {
    setOllamaManualConfirmed(false);
    setOllamaServerStatus('unknown');
  }, [ragSettings.LLM_BASE_URL, ragSettings.OLLAMA_EMBEDDING_URL, chatProvider, embeddingProvider]);

  // Update ragSettings when independent providers change (one-way: local state -> ragSettings)
  // Split the “first‐run” guard into two refs so chat and embedding effects don’t interfere.
  const updateChatRagSettingsRef = useRef(true);
  const updateEmbeddingRagSettingsRef = useRef(true);

  useEffect(() => {
    // Only update if this is a user‐initiated change, not a sync from ragSettings
    if (updateChatRagSettingsRef.current && chatProvider !== ragSettings.LLM_PROVIDER) {
      setRagSettings((prev: RAGSettingsProps["ragSettings"]) => ({
        ...prev,
        LLM_PROVIDER: chatProvider
      }));
    }
    updateChatRagSettingsRef.current = true;
  }, [chatProvider]);

  useEffect(() => {
    // Only update if this is a user‐initiated change, not a sync from ragSettings
    if (updateEmbeddingRagSettingsRef.current && embeddingProvider && embeddingProvider !== ragSettings.EMBEDDING_PROVIDER) {
      setRagSettings((prev: RAGSettingsProps["ragSettings"]) => ({
        ...prev,
        EMBEDDING_PROVIDER: embeddingProvider
      }));
    }
    updateEmbeddingRagSettingsRef.current = true;
  }, [embeddingProvider]);


  // Status tracking
  const [llmStatus, setLLMStatus] = useState<{ online: boolean; responseTime: number | null; checking: boolean }>({
    online: false,
    responseTime: null,
    checking: false,
  });
  const [embeddingStatus, setEmbeddingStatus] = useState<{ online: boolean; responseTime: number | null; checking: boolean }>({
    online: false,
    responseTime: null,
    checking: false,
  });
  const llmRetryTimeoutRef = useRef<number | null>(null);
  const embeddingRetryTimeoutRef = useRef<number | null>(null);
  
  // API key credentials for status checking
  const [apiCredentials, setApiCredentials] = useState<{[key: string]: boolean}>({});
  // Provider connection status tracking
  const [providerConnectionStatus, setProviderConnectionStatus] = useState<{
    [key: string]: { connected: boolean; checking: boolean; lastChecked?: Date }
  }>({});
  const [ollamaServerStatus, setOllamaServerStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [ollamaManualConfirmed, setOllamaManualConfirmed] = useState(false);

  useEffect(() => {
    return () => {
      if (llmRetryTimeoutRef.current) {
        clearTimeout(llmRetryTimeoutRef.current);
        llmRetryTimeoutRef.current = null;
      }
      if (embeddingRetryTimeoutRef.current) {
        clearTimeout(embeddingRetryTimeoutRef.current);
        embeddingRetryTimeoutRef.current = null;
      }
    };
  }, []);

  // Test connection to external providers
  const testProviderConnection = useCallback(async (provider: string): Promise<boolean> => {
    setProviderConnectionStatus(prev => ({
      ...prev,
      [provider]: { ...prev[provider], checking: true }
    }));

    try {
      // Use server-side API endpoint for secure connectivity testing
      const response = await fetch(`/api/providers/${provider}/status`);
      const result = await response.json();

      const isConnected = result.ok && result.reason === 'connected';

      setProviderConnectionStatus(prev => ({
        ...prev,
        [provider]: { connected: isConnected, checking: false, lastChecked: new Date() }
      }));

      return isConnected;
    } catch (error) {
      console.error(`Error testing ${provider} connection:`, error);
      setProviderConnectionStatus(prev => ({
        ...prev,
        [provider]: { connected: false, checking: false, lastChecked: new Date() }
      }));
      return false;
    }
  }, []);

  // Test provider connections when API credentials change
  useEffect(() => {
    const testConnections = async () => {
      // Test all supported providers
      const providers = ['openai', 'google', 'anthropic', 'openrouter', 'grok'];

      for (const provider of providers) {
        // Don't test if we've already checked recently (within last 30 seconds)
        const lastChecked = providerConnectionStatus[provider]?.lastChecked;
        const now = new Date();
        const timeSinceLastCheck = lastChecked ? now.getTime() - lastChecked.getTime() : Infinity;

        if (timeSinceLastCheck > 30000) { // 30 seconds
          console.log(`🔄 Testing ${provider} connection...`);
          await testProviderConnection(provider);
        }
      }
    };

    // Test connections periodically (every 60 seconds)
    testConnections();
    const interval = setInterval(testConnections, 60000);

    return () => clearInterval(interval);
  }, [apiCredentials, testProviderConnection]); // Test when credentials change

  useEffect(() => {
    const handleCredentialUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ keys?: string[] }>).detail;
      const updatedKeys = (detail?.keys ?? []).map(key => key.toUpperCase());

      if (updatedKeys.length === 0) {
        void reloadApiCredentials();
        return;
      }

      const touchedProviderKeys = updatedKeys.filter(key => key in CREDENTIAL_PROVIDER_MAP);
      if (touchedProviderKeys.length === 0) {
        return;
      }

      void reloadApiCredentials();

      touchedProviderKeys.forEach(key => {
        const provider = CREDENTIAL_PROVIDER_MAP[key as ProviderCredentialKey];
        if (provider) {
          void testProviderConnection(provider);
        }
      });
    };

    window.addEventListener('ptolemy:credentials-updated', handleCredentialUpdate);

    return () => {
      window.removeEventListener('ptolemy:credentials-updated', handleCredentialUpdate);
    };
  }, [reloadApiCredentials, testProviderConnection]);

  // Ref to track if initial test has been run (will be used after function definitions)
  const hasRunInitialTestRef = useRef(false);
  
  // Ollama metrics state
  const [ollamaMetrics, setOllamaMetrics] = useState({
    totalModels: 0,
    chatModels: 0,
    embeddingModels: 0,
    activeHosts: 0,
    loading: true,
    // Per-instance model counts
    llmInstanceModels: { chat: 0, embedding: 0, total: 0 },
    embeddingInstanceModels: { chat: 0, embedding: 0, total: 0 }
  });
  const { showToast } = useToast();

  // Manual test function with user feedback using backend proxy
const manualTestConnection = async (
    url: string,
    setStatus: React.Dispatch<React.SetStateAction<{ online: boolean; responseTime: number | null; checking: boolean }>>,
    instanceName: string,
    context?: 'chat' | 'embedding',
    options?: { suppressToast?: boolean }
  ): Promise<boolean> => {
    const suppressToast = options?.suppressToast ?? false;
    setStatus(prev => ({ ...prev, checking: true }));
    const startTime = Date.now();
    
    try {
      // Strip /v1 suffix for backend health check (backend expects base Ollama URL)
      const baseUrl = url.replace('/v1', '').replace(/\/$/, '');
      
      // Use the backend health check endpoint to avoid CORS issues
      const backendHealthUrl = `/api/ollama/instances/health?instance_urls=${encodeURIComponent(baseUrl)}&include_models=true`;
      
      const response = await fetch(backendHealthUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const instanceStatus = data.instance_status?.[baseUrl];
        
        if (instanceStatus?.is_healthy) {
          const responseTime = Math.round(instanceStatus.response_time_ms || (Date.now() - startTime));
          setStatus({ online: true, responseTime, checking: false });

          // Context-aware model count display
          let modelCount = instanceStatus.models_available || 0;
          let modelType = 'models';

          if (context === 'chat') {
            modelCount = ollamaMetrics.llmInstanceModels?.chat || 0;
            modelType = 'chat models';
          } else if (context === 'embedding') {
            modelCount = ollamaMetrics.embeddingInstanceModels?.embedding || 0;
            modelType = 'embedding models';
          }

          if (!suppressToast) {
            showToast(`${instanceName} connection successful: ${modelCount} ${modelType} available (${responseTime}ms)`, 'success');
          }

          // Scenario 2: Manual "Test Connection" button - refresh Ollama metrics if Ollama provider is selected
          if (ragSettings.LLM_PROVIDER === 'ollama' || embeddingProvider === 'ollama' || context === 'embedding') {
            console.log('🔄 Fetching Ollama metrics - Test Connection button clicked');
            fetchOllamaMetrics();
          }

          return true;
        } else {
          setStatus({ online: false, responseTime: null, checking: false });
          if (!suppressToast) {
            showToast(`${instanceName} connection failed: ${instanceStatus?.error_message || 'Instance is not healthy'}`, 'error');
          }
          return false;
        }
      } else {
        setStatus({ online: false, responseTime: null, checking: false });
        if (!suppressToast) {
          showToast(`${instanceName} connection failed: Backend proxy error (HTTP ${response.status})`, 'error');
        }
        return false;
      }
    } catch (error: any) {
      setStatus({ online: false, responseTime: null, checking: false });

      if (!suppressToast) {
        if (error.name === 'AbortError') {
          showToast(`${instanceName} connection failed: Request timeout (>15s)`, 'error');
        } else {
          showToast(`${instanceName} connection failed: ${error.message || 'Unknown error'}`, 'error');
        }
      }

      return false;
    }
  };

  // Function to fetch Ollama metrics
  const fetchOllamaMetrics = async () => {
    try {
      setOllamaMetrics(prev => ({ ...prev, loading: true }));

      // Prepare normalized instance URLs for the API call
      const instanceUrls: string[] = [];
      const llmUrlBase = normalizeBaseUrl(llmInstanceConfig.url);
      const embUrlBase = normalizeBaseUrl(embeddingInstanceConfig.url);

      if (llmUrlBase) instanceUrls.push(llmUrlBase);
      if (embUrlBase && embUrlBase !== llmUrlBase) {
        instanceUrls.push(embUrlBase);
      }

      if (instanceUrls.length === 0) {
        setOllamaMetrics(prev => ({ ...prev, loading: false }));
        return;
      }

      // Build query parameters
      const params = new URLSearchParams();
      instanceUrls.forEach(url => params.append('instance_urls', url));
      params.append('include_capabilities', 'true');

      // Fetch models from configured instances
      const modelsResponse = await fetch(`/api/ollama/models?${params.toString()}`);
      const modelsData = await modelsResponse.json();

      if (modelsResponse.ok) {
        // Extract models from the response
        const allChatModels = modelsData.chat_models || [];
        const allEmbeddingModels = modelsData.embedding_models || [];
        
        // Count models for LLM instance
        const llmChatModels = allChatModels.filter((model: any) => 
          normalizeBaseUrl(model.instance_url) === llmUrlBase
        );
        const llmEmbeddingModels = allEmbeddingModels.filter((model: any) => 
          normalizeBaseUrl(model.instance_url) === llmUrlBase
        );

        // Count models for Embedding instance
        const embChatModels = allChatModels.filter((model: any) => 
          normalizeBaseUrl(model.instance_url) === embUrlBase
        );
        const embEmbeddingModels = allEmbeddingModels.filter((model: any) => 
          normalizeBaseUrl(model.instance_url) === embUrlBase
        );
        
        // Calculate totals
        const totalModels = modelsData.total_models || 0;
        const activeHosts = (llmStatus.online ? 1 : 0) + (embeddingStatus.online ? 1 : 0);

        setOllamaMetrics({
          totalModels: totalModels,
          chatModels: allChatModels.length,
          embeddingModels: allEmbeddingModels.length,
          activeHosts,
          loading: false,
          // Per-instance model counts
          llmInstanceModels: {
            chat: llmChatModels.length,
            embedding: llmEmbeddingModels.length,
            total: llmChatModels.length + llmEmbeddingModels.length
          },
          embeddingInstanceModels: {
            chat: embChatModels.length,
            embedding: embEmbeddingModels.length,
            total: embChatModels.length + embEmbeddingModels.length
          }
        });
      } else {
        console.error('Failed to fetch models:', modelsData);
        setOllamaMetrics(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Error fetching Ollama metrics:', error);
      setOllamaMetrics(prev => ({ ...prev, loading: false }));
    }
  };

  // Auto-check status when instances are configured or when Ollama is selected
  // Use refs to prevent infinite connection testing
  const lastMetricsFetchRef = useRef({ provider: '', embProvider: '', llmUrl: '', embUrl: '', llmOnline: false, embOnline: false });
  
  // Auto-testing disabled to prevent API calls on every keystroke per user request
  // Connection testing should only happen on manual "Test Connection" or "Save Changes" button clicks
  // React.useEffect(() => {
  //   const currentConfig = {
  //     url: llmInstanceConfig.url,
  //     name: llmInstanceConfig.name,
  //     provider: ragSettings.LLM_PROVIDER
  //   };
  //   
  //   const shouldTest = ragSettings.LLM_PROVIDER === 'ollama' && 
  //                     llmInstanceConfig.url && 
  //                     llmInstanceConfig.name && 
  //                     llmInstanceConfig.url !== 'http://localhost:11434/v1' &&
  //                     (currentConfig.url !== lastTestedLLMConfigRef.current.url ||
  //                      currentConfig.name !== lastTestedLLMConfigRef.current.name ||
  //                      currentConfig.provider !== lastTestedLLMConfigRef.current.provider);
  //   
  //   if (shouldTest) {
  //     lastTestedLLMConfigRef.current = currentConfig;
  //     testConnection(llmInstanceConfig.url, setLLMStatus);
  //   }
  // }, [llmInstanceConfig.url, llmInstanceConfig.name, ragSettings.LLM_PROVIDER]);

  // Auto-testing disabled to prevent API calls on every keystroke per user request
  // Connection testing should only happen on manual "Test Connection" or "Save Changes" button clicks
  // React.useEffect(() => {
  //   const currentConfig = {
  //     url: embeddingInstanceConfig.url,
  //     name: embeddingInstanceConfig.name,
  //     provider: ragSettings.LLM_PROVIDER
  //   };
  //   
  //   const shouldTest = ragSettings.LLM_PROVIDER === 'ollama' && 
  //                     embeddingInstanceConfig.url && 
  //                     embeddingInstanceConfig.name && 
  //                     embeddingInstanceConfig.url !== 'http://localhost:11434/v1' &&
  //                     (currentConfig.url !== lastTestedEmbeddingConfigRef.current.url ||
  //                      currentConfig.name !== lastTestedEmbeddingConfigRef.current.name ||
  //                      currentConfig.provider !== lastTestedEmbeddingConfigRef.current.provider);
  //   
  //   if (shouldTest) {
  //     lastTestedEmbeddingConfigRef.current = currentConfig;
  //     testConnection(embeddingInstanceConfig.url, setEmbeddingStatus);
  //   }
  // }, [embeddingInstanceConfig.url, embeddingInstanceConfig.name, ragSettings.LLM_PROVIDER]);

  React.useEffect(() => {
    const current = {
      provider: ragSettings.LLM_PROVIDER ?? '',
      embProvider: embeddingProvider ?? '',
      llmUrl: normalizeBaseUrl(llmInstanceConfig.url) ?? '',
      embUrl: normalizeBaseUrl(embeddingInstanceConfig.url) ?? '',
      llmOnline: llmStatus.online,
      embOnline: embeddingStatus.online,
    };
    const last = lastMetricsFetchRef.current;

    const meaningfulChange =
      current.provider !== last.provider ||
      current.embProvider !== last.embProvider ||
      current.llmUrl !== last.llmUrl ||
      current.embUrl !== last.embUrl ||
      current.llmOnline !== last.llmOnline ||
      current.embOnline !== last.embOnline;

    if ((current.provider === 'ollama' || current.embProvider === 'ollama') && meaningfulChange) {
      lastMetricsFetchRef.current = current;
      console.log('🔄 Fetching Ollama metrics - state changed');
      fetchOllamaMetrics();
    }
  }, [ragSettings.LLM_PROVIDER, embeddingProvider, llmStatus.online, embeddingStatus.online]);

  const hasApiCredential = (credentialKey: ProviderCredentialKey): boolean => {
    if (credentialKey in apiCredentials) {
      return Boolean(apiCredentials[credentialKey]);
    }

    const fallbackKey = Object.keys(apiCredentials).find(
      key => key.toUpperCase() === credentialKey,
    );

    return fallbackKey ? Boolean(apiCredentials[fallbackKey]) : false;
  };

  // Function to check if a provider is properly configured
  const getProviderStatus = (providerKey: string): 'configured' | 'missing' | 'partial' => {
    switch (providerKey) {
      case 'openai':
        const hasOpenAIKey = hasApiCredential('OPENAI_API_KEY');

        // Only show configured if we have both API key AND confirmed connection
        const openAIConnected = providerConnectionStatus['openai']?.connected || false;
        const isChecking = providerConnectionStatus['openai']?.checking || false;

        // Intentionally avoid logging API key material.

        if (!hasOpenAIKey) return 'missing';
        if (isChecking) return 'partial';
        return openAIConnected ? 'configured' : 'missing';
        
      case 'google':
        const hasGoogleKey = hasApiCredential('GOOGLE_API_KEY');
        
        // Only show configured if we have both API key AND confirmed connection
        const googleConnected = providerConnectionStatus['google']?.connected || false;
        const googleChecking = providerConnectionStatus['google']?.checking || false;

        if (!hasGoogleKey) return 'missing';
        if (googleChecking) return 'partial';
        return googleConnected ? 'configured' : 'missing';
        
      case 'ollama':
        {
          if (ollamaManualConfirmed || llmStatus.online || embeddingStatus.online) {
            return 'configured';
          }

          if (ollamaServerStatus === 'online') {
            return 'partial';
          }

          if (ollamaServerStatus === 'offline') {
            return 'missing';
          }

          return 'missing';
        }
      case 'anthropic':
        const hasAnthropicKey = hasApiCredential('ANTHROPIC_API_KEY');
        const anthropicConnected = providerConnectionStatus['anthropic']?.connected || false;
        const anthropicChecking = providerConnectionStatus['anthropic']?.checking || false;
        if (!hasAnthropicKey) return 'missing';
        if (anthropicChecking) return 'partial';
        return anthropicConnected ? 'configured' : 'missing';
      case 'grok':
        const hasGrokKey = hasApiCredential('GROK_API_KEY');
        const grokConnected = providerConnectionStatus['grok']?.connected || false;
        const grokChecking = providerConnectionStatus['grok']?.checking || false;
        if (!hasGrokKey) return 'missing';
        if (grokChecking) return 'partial';
        return grokConnected ? 'configured' : 'missing';
      case 'openrouter':
        const hasOpenRouterKey = hasApiCredential('OPENROUTER_API_KEY');
        const openRouterConnected = providerConnectionStatus['openrouter']?.connected || false;
        const openRouterChecking = providerConnectionStatus['openrouter']?.checking || false;
        if (!hasOpenRouterKey) return 'missing';
        if (openRouterChecking) return 'partial';
        return openRouterConnected ? 'configured' : 'missing';
      default:
        return 'missing';
    }
  };

  const resolvedProviderForAlert = activeSelection === 'chat' ? chatProvider : embeddingProvider;
  const activeProviderKey = isProviderKey(resolvedProviderForAlert)
    ? (resolvedProviderForAlert as ProviderKey)
    : undefined;
  const selectedProviderStatus = activeProviderKey ? getProviderStatus(activeProviderKey) : undefined;

  let providerAlertMessage: string | null = null;
  let providerAlertClassName = '';

  if (activeProviderKey === 'ollama') {
    if (ollamaServerStatus === 'offline') {
      providerAlertMessage = 'Local Ollama service is not running. Start the Ollama server and ensure it is reachable at the configured URL.';
      providerAlertClassName = providerErrorAlertStyle;
    } else if (selectedProviderStatus === 'partial' && ollamaServerStatus === 'online') {
      providerAlertMessage = 'Local Ollama service detected. Click "Test Connection" to confirm model availability.';
      providerAlertClassName = providerWarningAlertStyle;
    }
  } else if (activeProviderKey && selectedProviderStatus === 'missing') {
    const providerName = providerDisplayNames[activeProviderKey] ?? activeProviderKey;
    providerAlertMessage = `${providerName} API key is not configured. Add it in Settings > API Keys.`;
    providerAlertClassName = providerMissingAlertStyle;
  }

  const shouldShowProviderAlert = Boolean(providerAlertMessage);
  
  useEffect(() => {
    if (chatProvider !== 'ollama') {
      if (llmRetryTimeoutRef.current) {
        clearTimeout(llmRetryTimeoutRef.current);
        llmRetryTimeoutRef.current = null;
      }
      return;
    }

    const baseUrl = (
      ragSettings.LLM_BASE_URL?.trim() ||
      llmInstanceConfig.url?.trim() ||
      DEFAULT_OLLAMA_URL
    );

    if (!baseUrl) {
      return;
    }

    const instanceName = llmInstanceConfig.name?.trim().length
      ? llmInstanceConfig.name
      : 'LLM Instance';

    let cancelled = false;

    const runTest = async () => {
      if (cancelled) return;

      const success = await manualTestConnection(
        baseUrl,
        setLLMStatus,
        instanceName,
        'chat',
        { suppressToast: true }
      );

      if (!success && chatProvider === 'ollama' && !cancelled) {
        llmRetryTimeoutRef.current = window.setTimeout(runTest, 5000);
      }
    };

    if (llmRetryTimeoutRef.current) {
      clearTimeout(llmRetryTimeoutRef.current);
      llmRetryTimeoutRef.current = null;
    }

    setLLMStatus(prev => ({ ...prev, checking: true }));
    runTest();

    return () => {
      cancelled = true;
      if (llmRetryTimeoutRef.current) {
        clearTimeout(llmRetryTimeoutRef.current);
        llmRetryTimeoutRef.current = null;
      }
    };
  }, [chatProvider, ragSettings.LLM_BASE_URL, ragSettings.LLM_INSTANCE_NAME, llmInstanceConfig.url, llmInstanceConfig.name]);

  useEffect(() => {
    if (embeddingProvider !== 'ollama') {
      if (embeddingRetryTimeoutRef.current) {
        clearTimeout(embeddingRetryTimeoutRef.current);
        embeddingRetryTimeoutRef.current = null;
      }
      return;
    }

    const baseUrl = (
      ragSettings.OLLAMA_EMBEDDING_URL?.trim() ||
      embeddingInstanceConfig.url?.trim() ||
      DEFAULT_OLLAMA_URL
    );

    if (!baseUrl) {
      return;
    }

    const instanceName = embeddingInstanceConfig.name?.trim().length
      ? embeddingInstanceConfig.name
      : 'Embedding Instance';

    let cancelled = false;

    const runTest = async () => {
      if (cancelled) return;

      const success = await manualTestConnection(
        baseUrl,
        setEmbeddingStatus,
        instanceName,
        'embedding',
        { suppressToast: true }
      );

      if (!success && embeddingProvider === 'ollama' && !cancelled) {
        embeddingRetryTimeoutRef.current = window.setTimeout(runTest, 5000);
      }
    };

    if (embeddingRetryTimeoutRef.current) {
      clearTimeout(embeddingRetryTimeoutRef.current);
      embeddingRetryTimeoutRef.current = null;
    }

    setEmbeddingStatus(prev => ({ ...prev, checking: true }));
    runTest();

    return () => {
      cancelled = true;
      if (embeddingRetryTimeoutRef.current) {
        clearTimeout(embeddingRetryTimeoutRef.current);
        embeddingRetryTimeoutRef.current = null;
      }
    };
  }, [embeddingProvider, ragSettings.OLLAMA_EMBEDDING_URL, ragSettings.OLLAMA_EMBEDDING_INSTANCE_NAME, embeddingInstanceConfig.url, embeddingInstanceConfig.name]);

  // Test Ollama connectivity when Settings page loads (scenario 4: page load)
  // This useEffect is placed after function definitions to ensure access to manualTestConnection
  useEffect(() => {
    console.log('🔍 Page load check:', {
      hasRunInitialTest: hasRunInitialTestRef.current,
      provider: ragSettings.LLM_PROVIDER,
      ragSettingsCount: Object.keys(ragSettings).length,
      llmUrl: llmInstanceConfig.url,
      llmName: llmInstanceConfig.name,
      embUrl: embeddingInstanceConfig.url,
      embName: embeddingInstanceConfig.name
    });
    
    // Only run once when data is properly loaded and not run before
    if (
      !hasRunInitialTestRef.current &&
      (ragSettings.LLM_PROVIDER === 'ollama' || embeddingProvider === 'ollama') &&
      Object.keys(ragSettings).length > 0
    ) {
      
      hasRunInitialTestRef.current = true;
      console.log('🔄 Settings page loaded with Ollama - Testing connectivity');

      // Test LLM instance if a URL is available (either saved or default)
      if (llmInstanceConfig.url) {
        setTimeout(() => {
          const instanceName = llmInstanceConfig.name || 'LLM Instance';
          console.log('🔍 Testing LLM instance on page load:', instanceName, llmInstanceConfig.url);
          manualTestConnection(
            llmInstanceConfig.url,
            setLLMStatus,
            instanceName,
            'chat',
            { suppressToast: true }
          );
        }, 1000); // Increased delay to ensure component is fully ready
      }
      // If no saved URL, run tests against default endpoint
      else {
        setTimeout(() => {
          const defaultInstanceName = 'Local Ollama (Default)';
          console.log('🔍 Testing default Ollama chat instance on page load:', DEFAULT_OLLAMA_URL);
          manualTestConnection(
            DEFAULT_OLLAMA_URL,
            setLLMStatus,
            defaultInstanceName,
            'chat',
            { suppressToast: true }
          );
        }, 1000);
      }

      // Test Embedding instance if configured and different from LLM instance
      if (embeddingInstanceConfig.url &&
          embeddingInstanceConfig.url !== llmInstanceConfig.url) {
        setTimeout(() => {
          const instanceName = embeddingInstanceConfig.name || 'Embedding Instance';
          console.log('🔍 Testing Embedding instance on page load:', instanceName, embeddingInstanceConfig.url);
          manualTestConnection(
            embeddingInstanceConfig.url,
            setEmbeddingStatus,
            instanceName,
            'embedding',
            { suppressToast: true }
          );
        }, 1500); // Stagger the tests
      }
      // If embedding provider is also Ollama but no specific URL is set, test default as fallback
      else if (embeddingProvider === 'ollama' && !embeddingInstanceConfig.url) {
        setTimeout(() => {
          const defaultEmbeddingName = 'Local Ollama (Default)';
          console.log('🔍 Testing default Ollama embedding instance on page load:', DEFAULT_OLLAMA_URL);
          manualTestConnection(
            DEFAULT_OLLAMA_URL,
            setEmbeddingStatus,
            defaultEmbeddingName,
            'embedding',
            { suppressToast: true }
          );
        }, 1500);
      }

      // Fetch Ollama metrics after testing connections
      setTimeout(() => {
        console.log('📊 Fetching Ollama metrics on page load');
        fetchOllamaMetrics();
      }, 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ragSettings.LLM_PROVIDER, llmInstanceConfig.url, llmInstanceConfig.name, 
      embeddingInstanceConfig.url, embeddingInstanceConfig.name]); // Don't include function deps to avoid re-runs

  const activeProvider = activeSelection === 'chat' ? chatProvider : embeddingProvider;
  const activeInstanceConfig = activeSelection === 'chat' ? llmInstanceConfig : embeddingInstanceConfig;
  const activeStatus = activeSelection === 'chat' ? llmStatus : embeddingStatus;
  const activeModel = activeSelection === 'chat'
    ? getDisplayedChatModel(ragSettings)
    : getDisplayedEmbeddingModel(ragSettings);
  const availableModels = activeSelection === 'chat'
    ? ollamaMetrics.llmInstanceModels?.chat
    : ollamaMetrics.embeddingInstanceModels?.embedding;
  const isOllamaActive = activeProvider === 'ollama';

  const providerOptions = [
    { key: 'openai', name: 'OpenAI', logo: '/img/OpenAI.png' },
    { key: 'google', name: 'Google', logo: '/img/google-logo.svg' },
    { key: 'openrouter', name: 'OpenRouter', logo: '/img/OpenRouter.png' },
    { key: 'ollama', name: 'Ollama', logo: '/img/Ollama.png' },
    { key: 'anthropic', name: 'Anthropic', logo: '/img/claude-logo.svg' },
    { key: 'grok', name: 'Grok', logo: '/img/Grok.png' },
  ];

  const handleProviderSelect = (providerKey: ProviderKey, selection: 'chat' | 'embedding') => {
    if (selection === 'chat') {
      setChatProvider(providerKey);
      const savedModels = providerModels[providerKey] || getDefaultModels(providerKey);
      setRagSettings((prev: RAGSettingsProps["ragSettings"]) => ({
        ...prev,
        MODEL_CHOICE: savedModels.chatModel,
      }));
    } else {
      setEmbeddingProvider(providerKey);
      const savedModels = providerModels[providerKey] || getDefaultModels(providerKey);
      setRagSettings((prev: RAGSettingsProps["ragSettings"]) => ({
        ...prev,
        EMBEDDING_MODEL: savedModels.embeddingModel,
      }));
    }
  };

  const statusToBadgeVariant = (status: 'configured' | 'missing' | 'partial') => {
    if (status === 'configured') return 'success';
    if (status === 'partial') return 'warning';
    return 'destructive';
  };

  const renderProviderGrid = (selection: 'chat' | 'embedding') => {
    const providers = providerOptions.filter(provider =>
      selection === 'chat' || EMBEDDING_CAPABLE_PROVIDERS.includes(provider.key as ProviderKey),
    );

    return (
      <div
        className={cn(
          'grid gap-3',
          selection === 'chat' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 md:grid-cols-4',
        )}
      >
        {providers.map((provider) => {
          const providerKey = provider.key as ProviderKey;
          const isSelected =
            selection === 'chat' ? chatProvider === providerKey : embeddingProvider === providerKey;
          const status = getProviderStatus(providerKey);

          return (
            <button
              key={provider.key}
              type="button"
              onClick={() => handleProviderSelect(providerKey, selection)}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-md border p-3 text-center text-sm transition',
                isSelected ? colorStyles[providerKey] : 'border-border hover:bg-muted/50',
              )}
            >
              <img
                src={provider.logo}
                alt={`${provider.name} logo`}
                className={cn(
                  'h-8 w-8',
                  provider.key === 'openai' || provider.key === 'grok' ? 'rounded bg-white p-1' : '',
                )}
              />
              <span className={provider.key === 'openrouter' ? 'text-xs' : 'text-sm'}>{provider.name}</span>
              <Badge
                variant={statusToBadgeVariant(status)}
                className="absolute right-2 top-2 text-[10px] uppercase"
              >
                {status}
              </Badge>
            </button>
          );
        })}
      </div>
    );
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">RAG settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure retrieval and model choices for knowledge search and synthesis.
        </p>
      </div>

      <div className="space-y-4">
        <Tabs value={activeSelection} onValueChange={(value) => setActiveSelection(value as 'chat' | 'embedding')}>
          <TabsList>
            <TabsTrigger value="chat" className="gap-2">
              <LuBrainCircuit className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="embedding" className="gap-2">
              <PiDatabaseThin className="h-4 w-4" />
              Embeddings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-4">
            {renderProviderGrid('chat')}
            {chatProvider !== 'ollama' ? (
              <Input
                label="Chat model"
                value={getDisplayedChatModel(ragSettings)}
                onChange={e => setRagSettings({
                  ...ragSettings,
                  MODEL_CHOICE: e.target.value,
                })}
                placeholder={getModelPlaceholder(chatProvider)}
              />
            ) : (
              <div className="rounded-md bg-muted/40 p-3 text-sm">
                <div className="font-medium">Chat model</div>
                <p className="text-muted-foreground">Configured via the Ollama instance.</p>
                <Badge variant="outline" className="mt-2 text-xs text-muted-foreground">
                  {getDisplayedChatModel(ragSettings) || 'Not selected'}
                </Badge>
              </div>
            )}
          </TabsContent>

          <TabsContent value="embedding" className="space-y-4">
            {renderProviderGrid('embedding')}
            {embeddingProvider !== 'ollama' ? (
              <Input
                label="Embedding model"
                value={getDisplayedEmbeddingModel(ragSettings)}
                onChange={e => setRagSettings({
                  ...ragSettings,
                  EMBEDDING_MODEL: e.target.value,
                })}
                placeholder={getEmbeddingPlaceholder(embeddingProvider)}
              />
            ) : (
              <div className="rounded-md bg-muted/40 p-3 text-sm">
                <div className="font-medium">Embedding model</div>
                <p className="text-muted-foreground">Configured via the Ollama instance.</p>
                <Badge variant="outline" className="mt-2 text-xs text-muted-foreground">
                  {getDisplayedEmbeddingModel(ragSettings) || 'Not selected'}
                </Badge>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {shouldShowProviderAlert && (
          <div className={cn("rounded-md p-3 text-sm", providerAlertClassName)}>
            {providerAlertMessage}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {isOllamaActive && (
            <Button variant="outline" onClick={() => setShowOllamaConfig(!showOllamaConfig)} className="gap-2">
              <Cog className={`h-4 w-4 transition-transform ${showOllamaConfig ? 'rotate-90' : ''}`} />
              {showOllamaConfig ? 'Hide Ollama config' : 'Configure Ollama'}
            </Button>
          )}
          <Button
            onClick={async () => {
              try {
                setSaving(true);

                const updatedSettings = {
                  ...ragSettings,
                  LLM_BASE_URL: llmInstanceConfig.url,
                  LLM_INSTANCE_NAME: llmInstanceConfig.name,
                  OLLAMA_EMBEDDING_URL: embeddingInstanceConfig.url,
                  OLLAMA_EMBEDDING_INSTANCE_NAME: embeddingInstanceConfig.name,
                };

                await credentialsService.updateRagSettings(updatedSettings);
                setRagSettings(updatedSettings);
                showToast('RAG settings saved successfully!', 'success');
              } catch (err) {
                console.error('Failed to save RAG settings:', err);
                showToast('Failed to save settings', 'error');
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save settings
              </>
            )}
          </Button>
        </div>

        {showOllamaConfig && isOllamaActive && (
          <div className="rounded-md bg-muted/40 p-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold">
                  {activeSelection === 'chat' ? 'LLM chat instance' : 'Embedding instance'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {activeSelection === 'chat'
                    ? 'Configure the Ollama instance used for chat completions.'
                    : 'Configure the Ollama instance used for embeddings.'}
                </p>
              </div>
              <Badge variant={activeStatus.online ? 'success' : activeStatus.checking ? 'warning' : 'destructive'}>
                {activeStatus.checking ? 'Checking' : activeStatus.online ? 'Online' : 'Offline'}
              </Badge>
            </div>

            <div className="rounded-md bg-background p-4 space-y-3">
              {activeInstanceConfig.name && activeInstanceConfig.url ? (
                <>
                  <div>
                    <div className="text-sm font-medium">{activeInstanceConfig.name}</div>
                    <div className="text-xs font-mono text-muted-foreground">{activeInstanceConfig.url}</div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Selected model</span>
                    <span className="font-medium">{activeModel || 'Not selected'}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {activeStatus.checking ? 'Testing connection...' : null}
                    {!activeStatus.checking && (ollamaMetrics.loading
                      ? 'Loading model metrics...'
                      : `${availableModels || 0} models available`)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => (activeSelection === 'chat' ? setShowEditLLMModal(true) : setShowEditEmbeddingModal(true))}
                    >
                      Edit settings
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const success = await manualTestConnection(
                          activeInstanceConfig.url,
                          activeSelection === 'chat' ? setLLMStatus : setEmbeddingStatus,
                          activeInstanceConfig.name,
                          activeSelection === 'chat' ? 'chat' : 'embedding',
                        );

                        setOllamaManualConfirmed(success);
                        setOllamaServerStatus(success ? 'online' : 'offline');
                      }}
                      disabled={activeStatus.checking}
                    >
                      {activeStatus.checking ? 'Testing...' : 'Test connection'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => (activeSelection === 'chat'
                        ? setShowLLMModelSelectionModal(true)
                        : setShowEmbeddingModelSelectionModal(true))}
                    >
                      Select model
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowModelDiscoveryModal(true)}>
                      Discover models
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                  <span>No instance configured.</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => (activeSelection === 'chat' ? setShowEditLLMModal(true) : setShowEditEmbeddingModal(true))}
                  >
                    Add instance
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-md bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Configuration</TableHead>
                    <TableHead>{activeSelection === 'chat' ? 'LLM instance' : 'Embedding instance'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Instance name</TableCell>
                    <TableCell>{activeInstanceConfig.name || 'Not configured'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Instance URL</TableCell>
                    <TableCell className="font-mono text-xs">{activeInstanceConfig.url || 'Not configured'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Status</TableCell>
                    <TableCell>
                      <Badge variant={activeStatus.online ? 'success' : activeStatus.checking ? 'warning' : 'destructive'}>
                        {activeStatus.checking
                          ? 'Checking'
                          : activeStatus.online
                            ? `Online (${activeStatus.responseTime}ms)`
                            : 'Offline'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Selected model</TableCell>
                    <TableCell>{activeModel || 'Not selected'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Available models</TableCell>
                    <TableCell>
                      {ollamaMetrics.loading ? (
                        <Loader className="h-3 w-3 animate-spin" />
                      ) : (
                        `${availableModels || 0}`
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Retrieval behavior</h3>
          <p className="text-xs text-muted-foreground">Tune retrieval and ranking features.</p>
        </div>
        <ToggleField
          id="contextualEmbeddings"
          checked={ragSettings.USE_CONTEXTUAL_EMBEDDINGS}
          onCheckedChange={(checked) => setRagSettings({
            ...ragSettings,
            USE_CONTEXTUAL_EMBEDDINGS: checked,
          })}
          label="Use contextual embeddings"
          description="Enhance embeddings with contextual information for better retrieval."
        />
        {ragSettings.USE_CONTEXTUAL_EMBEDDINGS && (
          <div className="max-w-xs">
            <Input
              id="contextual-workers"
              type="number"
              min={1}
              max={10}
              label="Max workers"
              description="Controls parallel processing for embeddings (1-10)."
              value={ragSettings.CONTEXTUAL_EMBEDDINGS_MAX_WORKERS}
              onChange={e => setRagSettings({
                ...ragSettings,
                CONTEXTUAL_EMBEDDINGS_MAX_WORKERS: parseInt(e.target.value, 10) || 3,
              })}
            />
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleField
            id="hybridSearch"
            checked={ragSettings.USE_HYBRID_SEARCH}
            onCheckedChange={(checked) => setRagSettings({
              ...ragSettings,
              USE_HYBRID_SEARCH: checked,
            })}
            label="Use hybrid search"
            description="Combine vector and keyword search for better results."
          />
          <ToggleField
            id="agenticRag"
            checked={ragSettings.USE_AGENTIC_RAG}
            onCheckedChange={(checked) => setRagSettings({
              ...ragSettings,
              USE_AGENTIC_RAG: checked,
            })}
            label="Use agentic RAG"
            description="Enable agent workflows and specialized technical search."
          />
          <ToggleField
            id="reranking"
            checked={ragSettings.USE_RERANKING}
            onCheckedChange={(checked) => setRagSettings({
              ...ragSettings,
              USE_RERANKING: checked,
            })}
            label="Use reranking"
            description="Apply cross-encoder reranking to improve relevance."
          />
          <ToggleField
            id="llmRouter"
            checked={ragSettings.USE_LLM_ROUTER}
            onCheckedChange={(checked) => setRagSettings({
              ...ragSettings,
              USE_LLM_ROUTER: checked,
            })}
            label="Use LLM routing"
            description="Route queries to likely sources with a small LLM call."
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-between"
          onClick={() => setShowCrawlingSettings(!showCrawlingSettings)}
        >
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Crawling performance
          </span>
          {showCrawlingSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {showCrawlingSettings && (
          <div className="rounded-md border bg-muted/40 p-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                id="crawl-batch-size"
                type="number"
                min={10}
                max={100}
                label="Batch size"
                description="URLs to crawl in parallel (10-100)."
                value={ragSettings.CRAWL_BATCH_SIZE || 50}
                onChange={e => setRagSettings({
                  ...ragSettings,
                  CRAWL_BATCH_SIZE: parseInt(e.target.value, 10) || 50,
                })}
              />
              <Input
                id="crawl-max-concurrent"
                type="number"
                min={1}
                max={20}
                label="Max concurrent"
                description="Pages to crawl in parallel per operation (1-20)."
                value={ragSettings.CRAWL_MAX_CONCURRENT || 10}
                onChange={e => setRagSettings({
                  ...ragSettings,
                  CRAWL_MAX_CONCURRENT: parseInt(e.target.value, 10) || 10,
                })}
              />
              <Input
                id="crawl-limit"
                type="number"
                min={1}
                max={10}
                label="Concurrent crawls"
                description="Max simultaneous crawl operations (1-10)."
                value={ragSettings.CONCURRENT_CRAWL_LIMIT || 3}
                onChange={e => setRagSettings({
                  ...ragSettings,
                  CONCURRENT_CRAWL_LIMIT: parseInt(e.target.value, 10) || 3,
                })}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField
                label="Wait strategy"
                value={ragSettings.CRAWL_WAIT_STRATEGY || 'domcontentloaded'}
                onChange={e => setRagSettings({
                  ...ragSettings,
                  CRAWL_WAIT_STRATEGY: e.target.value,
                })}
                options={[
                  { value: 'domcontentloaded', label: 'DOM loaded (fast)' },
                  { value: 'networkidle', label: 'Network idle (thorough)' },
                  { value: 'load', label: 'Full load (slowest)' },
                ]}
              />
              <Input
                id="crawl-timeout"
                type="number"
                min={5}
                max={120}
                label="Page timeout (sec)"
                value={(ragSettings.CRAWL_PAGE_TIMEOUT || 60000) / 1000}
                onChange={e => setRagSettings({
                  ...ragSettings,
                  CRAWL_PAGE_TIMEOUT: (parseInt(e.target.value, 10) || 60) * 1000,
                })}
              />
              <Input
                id="crawl-delay"
                type="number"
                min={0.1}
                max={5}
                step={0.1}
                label="Render delay (sec)"
                value={ragSettings.CRAWL_DELAY_BEFORE_HTML || 0.5}
                onChange={e => setRagSettings({
                  ...ragSettings,
                  CRAWL_DELAY_BEFORE_HTML: parseFloat(e.target.value) || 0.5,
                })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-between"
          onClick={() => setShowStorageSettings(!showStorageSettings)}
        >
          <span className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Storage performance
          </span>
          {showStorageSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {showStorageSettings && (
          <div className="rounded-md border bg-muted/40 p-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                id="document-batch"
                type="number"
                min={10}
                max={100}
                label="Document batch size"
                description="Chunks per batch (10-100)."
                value={ragSettings.DOCUMENT_STORAGE_BATCH_SIZE || 50}
                onChange={e => setRagSettings({
                  ...ragSettings,
                  DOCUMENT_STORAGE_BATCH_SIZE: parseInt(e.target.value, 10) || 50,
                })}
              />
              <Input
                id="embedding-batch"
                type="number"
                min={20}
                max={200}
                label="Embedding batch size"
                description="Per API call (20-200)."
                value={ragSettings.EMBEDDING_BATCH_SIZE || 100}
                onChange={e => setRagSettings({
                  ...ragSettings,
                  EMBEDDING_BATCH_SIZE: parseInt(e.target.value, 10) || 100,
                })}
              />
              <Input
                id="code-workers"
                type="number"
                min={1}
                max={10}
                label="Code extraction workers"
                description="Parallel workers (1-10)."
                value={ragSettings.CODE_SUMMARY_MAX_WORKERS || 3}
                onChange={e => setRagSettings({
                  ...ragSettings,
                  CODE_SUMMARY_MAX_WORKERS: parseInt(e.target.value, 10) || 3,
                })}
              />
            </div>
            <ToggleField
              id="parallelBatches"
              checked={ragSettings.ENABLE_PARALLEL_BATCHES !== false}
              onCheckedChange={(checked) => setRagSettings({
                ...ragSettings,
                ENABLE_PARALLEL_BATCHES: checked,
              })}
              label="Enable parallel processing"
              description="Process multiple document batches simultaneously for faster storage."
            />
          </div>
        )}
      </div>

      {showEditLLMModal && (
        <Dialog open={showEditLLMModal} onOpenChange={(open) => !open && setShowEditLLMModal(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit LLM instance</DialogTitle>
              <DialogDescription>Update the Ollama host used for chat models.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                label="Instance name"
                value={llmInstanceConfig.name}
                onChange={(e) => {
                  const newName = e.target.value;
                  setLLMInstanceConfig({ ...llmInstanceConfig, name: newName });
                  if (llmInstanceConfig.url === embeddingInstanceConfig.url && embeddingInstanceConfig.url !== '') {
                    setEmbeddingInstanceConfig({ ...embeddingInstanceConfig, name: newName });
                  }
                }}
                placeholder="Enter instance name"
              />

              <Input
                label="Instance URL"
                value={llmInstanceConfig.url}
                onChange={(e) => {
                  const newUrl = e.target.value;
                  setLLMInstanceConfig({ ...llmInstanceConfig, url: newUrl });
                  if (!embeddingInstanceConfig.url || !embeddingInstanceConfig.name) {
                    setEmbeddingInstanceConfig({
                      name: llmInstanceConfig.name || 'Default Ollama',
                      url: newUrl,
                    });
                  }
                }}
                placeholder="http://host.docker.internal:11434/v1"
              />

              <div className="flex items-center gap-2">
                <Checkbox
                  id="use-same-host"
                  checked={llmInstanceConfig.url === embeddingInstanceConfig.url && llmInstanceConfig.url !== ''}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setEmbeddingInstanceConfig({
                        name: llmInstanceConfig.name || 'Default Ollama',
                        url: llmInstanceConfig.url,
                      });
                    }
                  }}
                />
                <Label htmlFor="use-same-host" className="text-sm text-muted-foreground">
                  Use same host for embedding instance
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditLLMModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  setRagSettings({ ...ragSettings, LLM_BASE_URL: llmInstanceConfig.url });
                  setShowEditLLMModal(false);
                  showToast('LLM instance updated successfully', 'success');
                  setTimeout(() => {
                    manualTestConnection(
                      llmInstanceConfig.url,
                      setLLMStatus,
                      llmInstanceConfig.name,
                      'chat',
                      { suppressToast: true },
                    ).then((success) => {
                      setOllamaManualConfirmed(success);
                      setOllamaServerStatus(success ? 'online' : 'offline');
                    });
                    fetchOllamaMetrics();
                  }, 1000);
                }}
              >
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showEditEmbeddingModal && (
        <Dialog open={showEditEmbeddingModal} onOpenChange={(open) => !open && setShowEditEmbeddingModal(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit embedding instance</DialogTitle>
              <DialogDescription>Update the Ollama host used for embeddings.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                label="Instance name"
                value={embeddingInstanceConfig.name}
                onChange={(e) => setEmbeddingInstanceConfig({ ...embeddingInstanceConfig, name: e.target.value })}
                placeholder="Enter instance name"
              />

              <Input
                label="Instance URL"
                value={embeddingInstanceConfig.url}
                onChange={(e) => setEmbeddingInstanceConfig({ ...embeddingInstanceConfig, url: e.target.value })}
                placeholder="http://host.docker.internal:11434/v1"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditEmbeddingModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  setRagSettings({ ...ragSettings, OLLAMA_EMBEDDING_URL: embeddingInstanceConfig.url });
                  setShowEditEmbeddingModal(false);
                  showToast('Embedding instance updated successfully', 'success');
                  setTimeout(() => {
                    manualTestConnection(
                      embeddingInstanceConfig.url,
                      setEmbeddingStatus,
                      embeddingInstanceConfig.name,
                      'embedding',
                      { suppressToast: true },
                    ).then((success) => {
                      setOllamaManualConfirmed(success);
                      setOllamaServerStatus(success ? 'online' : 'offline');
                    });
                    fetchOllamaMetrics();
                  }, 1000);
                }}
              >
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showLLMModelSelectionModal && (
        <OllamaModelSelectionModal
          isOpen={showLLMModelSelectionModal}
          onClose={() => setShowLLMModelSelectionModal(false)}
          instances={[
            { name: llmInstanceConfig.name, url: llmInstanceConfig.url },
            { name: embeddingInstanceConfig.name, url: embeddingInstanceConfig.url },
          ]}
          currentModel={ragSettings.MODEL_CHOICE}
          modelType="chat"
          selectedInstanceUrl={normalizeBaseUrl(llmInstanceConfig.url) ?? ''}
          onSelectModel={(modelName: string) => {
            setRagSettings({ ...ragSettings, MODEL_CHOICE: modelName });
            showToast(`Selected LLM model: ${modelName}`, 'success');
          }}
        />
      )}

      {showEmbeddingModelSelectionModal && (
        <OllamaModelSelectionModal
          isOpen={showEmbeddingModelSelectionModal}
          onClose={() => setShowEmbeddingModelSelectionModal(false)}
          instances={[
            { name: llmInstanceConfig.name, url: llmInstanceConfig.url },
            { name: embeddingInstanceConfig.name, url: embeddingInstanceConfig.url },
          ]}
          currentModel={ragSettings.EMBEDDING_MODEL}
          modelType="embedding"
          selectedInstanceUrl={normalizeBaseUrl(embeddingInstanceConfig.url) ?? ''}
          onSelectModel={(modelName: string) => {
            setRagSettings({ ...ragSettings, EMBEDDING_MODEL: modelName });
            showToast(`Selected embedding model: ${modelName}`, 'success');
          }}
        />
      )}

      {showModelDiscoveryModal && (
        <OllamaModelDiscoveryModal
          isOpen={showModelDiscoveryModal}
          onClose={() => setShowModelDiscoveryModal(false)}
          instances={[]}
          onSelectModels={(selection: { chatModel?: string; embeddingModel?: string }) => {
            const updatedSettings = { ...ragSettings };
            if (selection.chatModel) {
              updatedSettings.MODEL_CHOICE = selection.chatModel;
            }
            if (selection.embeddingModel) {
              updatedSettings.EMBEDDING_MODEL = selection.embeddingModel;
            }
            setRagSettings(updatedSettings);
            setShowModelDiscoveryModal(false);
            fetchOllamaMetrics();
            showToast(`Selected models: ${selection.chatModel || 'none'} (chat), ${selection.embeddingModel || 'none'} (embedding)`, 'success');
          }}
        />
      )}
    </div>
  );
};

// Helper functions to get provider-specific model display
function getDisplayedChatModel(ragSettings: RAGSettingsProps["ragSettings"]): string {
  const provider = ragSettings.LLM_PROVIDER || 'openai';
  const modelChoice = ragSettings.MODEL_CHOICE;

  // Always prioritize user input to allow editing
  if (modelChoice !== undefined && modelChoice !== null) {
    return modelChoice;
  }

  // Only use defaults when there's no stored value
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022';
    case 'google':
      return 'gemini-1.5-flash';
    case 'grok':
      return 'grok-3-mini';
    case 'ollama':
      return '';
    case 'openrouter':
      return 'anthropic/claude-3.5-sonnet';
    default:
      return 'gpt-4o-mini';
  }
}

function getDisplayedEmbeddingModel(ragSettings: RAGSettingsProps["ragSettings"]): string {
  const provider = ragSettings.EMBEDDING_PROVIDER || ragSettings.LLM_PROVIDER || 'openai';
  const embeddingModel = ragSettings.EMBEDDING_MODEL;

  // Always prioritize user input to allow editing
  if (embeddingModel !== undefined && embeddingModel !== null && embeddingModel !== '') {
    return embeddingModel;
  }

  // Provide appropriate defaults based on LLM provider
  switch (provider) {
    case 'openai':
      return 'text-embedding-3-small';
    case 'google':
      return 'text-embedding-004';
    case 'ollama':
      return '';
    case 'openrouter':
      return 'text-embedding-3-small';  // Default to OpenAI embedding for OpenRouter
    case 'anthropic':
      return 'text-embedding-3-small';  // Use OpenAI embeddings with Claude
    case 'grok':
      return 'text-embedding-3-small';  // Use OpenAI embeddings with Grok
    default:
      return 'text-embedding-3-small';
  }
}

// Helper functions for model placeholders
function getModelPlaceholder(provider: ProviderKey): string {
  switch (provider) {
    case 'openai':
      return 'e.g., gpt-4o-mini';
    case 'anthropic':
      return 'e.g., claude-3-5-sonnet-20241022';
    case 'google':
      return 'e.g., gemini-1.5-flash';
    case 'grok':
      return 'e.g., grok-2-latest';
    case 'ollama':
      return 'e.g., llama2, mistral';
    case 'openrouter':
      return 'e.g., anthropic/claude-3.5-sonnet';
    default:
      return 'e.g., gpt-4o-mini';
  }
}

function getEmbeddingPlaceholder(provider: ProviderKey): string {
  switch (provider) {
    case 'openai':
      return 'Default: text-embedding-3-small';
    case 'anthropic':
      return 'Claude does not provide embedding models';
    case 'google':
      return 'e.g., text-embedding-004';
    case 'grok':
      return 'Grok does not provide embedding models';
    case 'ollama':
      return 'e.g., nomic-embed-text';
    case 'openrouter':
      return 'e.g., text-embedding-3-small';
    default:
      return 'Default: text-embedding-3-small';
  }
}

interface ToggleFieldProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description: string;
}

const ToggleField = ({
  id,
  checked,
  onCheckedChange,
  label,
  description,
}: ToggleFieldProps) => {
  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
};
