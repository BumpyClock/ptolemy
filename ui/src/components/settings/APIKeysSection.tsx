import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { Button } from "@/components/ui/Button";
import { credentialsService } from "../../services/credentialsService";
import { useToast } from "../../features/shared/hooks/useToast";

interface CustomCredential {
  key: string;
  value: string;
  description: string;
  originalValue?: string;
  originalKey?: string; // Track original key for renaming
  hasChanges?: boolean;
  is_encrypted?: boolean;
  showValue?: boolean; // Track per-credential visibility
  isNew?: boolean; // Track if this is a new unsaved credential
  isFromBackend?: boolean; // Track if credential came from backend (write-only once encrypted)
}

export const APIKeysSection = () => {
  const [customCredentials, setCustomCredentials] = useState<CustomCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { showToast } = useToast();

  // Load credentials on mount
  useEffect(() => {
    loadCredentials();
  }, []);

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = customCredentials.some(cred => cred.hasChanges || cred.isNew);
    setHasUnsavedChanges(hasChanges);
  }, [customCredentials]);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      
      // Load all credentials
      const allCredentials = await credentialsService.getAllCredentials();
      
      // Filter to only show API keys (credentials that end with _KEY or _API)
      const apiKeys = allCredentials.filter(cred => {
        const key = cred.key.toUpperCase();
        return key.includes('_KEY') || key.includes('_API') || key.includes('API_');
      });
      
      // Convert to UI format
      const uiCredentials = apiKeys.map(cred => {
        return {
          key: cred.key,
          value: cred.value || '',
          description: cred.description || '',
          originalValue: cred.value || '',
          originalKey: cred.key, // Track original key for updates
          hasChanges: false,
          is_encrypted: cred.is_encrypted || false,
          showValue: false,
          isNew: false,
          isFromBackend: true,
        };
      });
      
      setCustomCredentials(uiCredentials);
    } catch (err) {
      console.error('Failed to load credentials:', err);
      showToast('Failed to load credentials', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewRow = () => {
    const newCred: CustomCredential = {
      key: '',
      value: '',
      description: '',
      originalValue: '',
      hasChanges: true,
      is_encrypted: true, // Default to encrypted
      showValue: true, // Show value for new entries
      isNew: true,
      isFromBackend: false // New credentials are not from backend
    };
    
    setCustomCredentials([...customCredentials, newCred]);
  };

  const updateCredential = (index: number, field: keyof CustomCredential, value: any) => {
    setCustomCredentials(customCredentials.map((cred, i) => {
      if (i === index) {
        const updated = { ...cred, [field]: value };
        // Mark as changed if value differs from original
        if (field === 'key' || field === 'value' || field === 'is_encrypted') {
          updated.hasChanges = true;
        }
        // If user is editing the value of an encrypted credential from backend, make it editable
        if (field === 'value' && cred.isFromBackend && cred.is_encrypted && cred.value === '[ENCRYPTED]') {
          updated.isFromBackend = false; // Now it's being edited, treat like new credential
          updated.showValue = false; // Keep it hidden by default since it was encrypted
          updated.value = ''; // Clear the [ENCRYPTED] placeholder so they can enter new value
        }
        return updated;
      }
      return cred;
    }));
  };

  const toggleValueVisibility = (index: number) => {
    const cred = customCredentials[index];
    if (cred.isFromBackend && cred.is_encrypted && cred.value === '[ENCRYPTED]') {
      showToast('Encrypted credentials cannot be viewed. Edit to make changes.', 'warning');
      return;
    }
    updateCredential(index, 'showValue', !cred.showValue);
  };

  const toggleEncryption = (index: number) => {
    const cred = customCredentials[index];
    if (cred.isFromBackend && cred.is_encrypted && cred.value === '[ENCRYPTED]') {
      showToast('Edit the credential value to make changes.', 'warning');
      return;
    }
    updateCredential(index, 'is_encrypted', !cred.is_encrypted);
  };

  const deleteCredential = async (index: number) => {
    const cred = customCredentials[index];
    
    if (cred.isNew) {
      // Just remove from UI if it's not saved yet
      setCustomCredentials(customCredentials.filter((_, i) => i !== index));
    } else {
      try {
        await credentialsService.deleteCredential(cred.key);
        setCustomCredentials(customCredentials.filter((_, i) => i !== index));
        showToast(`Deleted ${cred.key}`, 'success');
      } catch (err) {
        console.error('Failed to delete credential:', err);
        showToast('Failed to delete credential', 'error');
      }
    }
  };

  const saveAllChanges = async () => {
    setSaving(true);
    let hasErrors = false;
    
    for (const cred of customCredentials) {
      if (cred.hasChanges || cred.isNew) {
        if (!cred.key) {
          showToast('Key name cannot be empty', 'error');
          hasErrors = true;
          continue;
        }
        
        try {
          if (cred.isNew) {
            await credentialsService.createCredential({
              key: cred.key,
              value: cred.value,
              description: cred.description,
              is_encrypted: cred.is_encrypted || false,
              category: 'api_keys'
            });
          } else {
            // If key has changed, delete old and create new
            if (cred.originalKey && cred.originalKey !== cred.key) {
              await credentialsService.deleteCredential(cred.originalKey);
              await credentialsService.createCredential({
                key: cred.key,
                value: cred.value,
                description: cred.description,
                is_encrypted: cred.is_encrypted || false,
                category: 'api_keys'
              });
            } else {
              // Just update the value
              await credentialsService.updateCredential({
                key: cred.key,
                value: cred.value,
                description: cred.description,
                is_encrypted: cred.is_encrypted || false,
                category: 'api_keys'
              });
            }
          }
        } catch (err) {
          console.error(`Failed to save ${cred.key}:`, err);
          showToast(`Failed to save ${cred.key}`, 'error');
          hasErrors = true;
        }
      }
    }
    
    if (!hasErrors) {
      showToast('All changes saved successfully!', 'success');
      await loadCredentials(); // Reload to get fresh data
    }
    
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="space-y-5 rounded-lg bg-muted/40 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
          {/* Description text */}
          <p className="text-sm text-muted-foreground mb-4">
            Manage your API keys and credentials for various services used by Ptolemy.
          </p>

          {/* Credentials list */}
          <div className="space-y-3">
            {/* Header row */}
            <div className="grid grid-cols-[240px_1fr_40px] gap-4 px-2 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div>Key Name</div>
              <div>Value</div>
              <div></div>
            </div>

            {/* Credential rows */}
            {customCredentials.map((cred, index) => (
              <div 
                key={index} 
                className="grid grid-cols-[240px_1fr_40px] gap-4 items-center"
              >
                {/* Key name column */}
                <div className="flex items-center">
                  <input
                    type="text"
                    value={cred.key}
                    onChange={(e) => updateCredential(index, 'key', e.target.value)}
                    placeholder="Enter key name"
                    className="w-full px-3 py-2 rounded-md bg-background border border-input text-sm font-mono text-foreground"
                  />
                </div>

                {/* Value column with encryption toggle */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={cred.showValue ? 'text' : 'password'}
                      value={cred.value}
                      onChange={(e) => updateCredential(index, 'value', e.target.value)}
                      placeholder={cred.is_encrypted && !cred.value ? 'Enter new value (encrypted)' : 'Enter value'}
                      className={`w-full px-3 py-2 pr-20 rounded-md border text-sm text-foreground ${
                        cred.isFromBackend && cred.is_encrypted && cred.value === '[ENCRYPTED]'
                          ? 'bg-muted border-border text-muted-foreground'
                          : 'bg-background border-input'
                      }`}
                      title={cred.isFromBackend && cred.is_encrypted && cred.value === '[ENCRYPTED]' 
                        ? 'Click to edit this encrypted credential' 
                        : undefined}
                    />
                    
                    {/* Show/Hide value button */}
                    <button
                      type="button"
                      onClick={() => toggleValueVisibility(index)}
                      disabled={cred.isFromBackend && cred.is_encrypted && cred.value === '[ENCRYPTED]'}
                      className={`absolute right-10 top-1/2 -translate-y-1/2 p-1.5 rounded transition-colors ${
                        cred.isFromBackend && cred.is_encrypted && cred.value === '[ENCRYPTED]'
                          ? 'cursor-not-allowed opacity-50'
                          : 'hover:bg-muted'
                      }`}
                      title={
                        cred.isFromBackend && cred.is_encrypted && cred.value === '[ENCRYPTED]'
                          ? 'Edit credential to view and modify'
                          : cred.showValue ? 'Hide value' : 'Show value'
                      }
                    >
                      {cred.showValue ? (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    
                    {/* Encryption toggle */}
                    <button
                      type="button"
                      onClick={() => toggleEncryption(index)}
                      disabled={cred.isFromBackend && cred.is_encrypted && cred.value === '[ENCRYPTED]'}
                      className={`
                        absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded transition-colors
                        ${cred.isFromBackend && cred.is_encrypted && cred.value === '[ENCRYPTED]'
                          ? 'cursor-not-allowed opacity-50 text-muted-foreground'
                          : cred.is_encrypted
                            ? 'text-foreground hover:bg-muted'
                            : 'text-muted-foreground hover:bg-muted'
                        }
                      `}
                      title={
                        cred.isFromBackend && cred.is_encrypted && cred.value === '[ENCRYPTED]'
                          ? 'Edit credential to modify encryption'
                          : cred.is_encrypted ? 'Encrypted - click to decrypt' : 'Not encrypted - click to encrypt'
                      }
                    >
                      {cred.is_encrypted ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <Unlock className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Actions column */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => deleteCredential(index)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="Delete credential"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add credential button */}
          <div className="pt-4 border-t border-border">
            <Button variant="outline" onClick={handleAddNewRow} size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Credential
            </Button>
          </div>

          {/* Save all changes button */}
          {hasUnsavedChanges && (
            <div className="pt-4 flex justify-center gap-2">
              <Button
                variant="ghost"
                onClick={loadCredentials}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button variant="default" onClick={saveAllChanges} disabled={saving}>
                {saving ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save All Changes
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Security Notice */}
          <div className="p-3 mt-6 mb-2 bg-muted rounded-md flex items-start gap-3">
            <div className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div className="text-sm text-muted-foreground">
              <p>
                Encrypted credentials are masked after saving. Click on a masked credential to edit it - this allows you to change the value and encryption settings.
              </p>
            </div>
          </div>
        </div>
  );
};
