'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, Trash2, Plus, Key, Eye, EyeOff, Check, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations, useLocale } from '@/contexts/LocaleContext';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

interface NewKeyResponse extends ApiKey {
  key?: string; // Only present on creation
}

const EXPIRATION_OPTIONS = [
  { value: '0', label: { zh: '永不过期', en: 'Never expires' } },
  { value: '30', label: { zh: '30 天', en: '30 days' } },
  { value: '90', label: { zh: '90 天', en: '90 days' } },
  { value: '180', label: { zh: '180 天', en: '180 days' } },
  { value: '365', label: { zh: '1 年', en: '1 year' } },
];

export function ApiKeyManager() {
  const t = useTranslations();
  const { locale } = useLocale();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [expirationDays, setExpirationDays] = useState('0');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/api-keys');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (err) {
      toast.error(locale === 'zh' ? '加载 API 密钥失败' : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error(locale === 'zh' ? '请输入名称' : 'Please enter a name');
      return;
    }

    setCreating(true);
    try {
      const body: { name: string; expires_in_days?: number } = { name: newKeyName.trim() };

      // Add expiration if not "never"
      const days = parseInt(expirationDays);
      if (days > 0) {
        body.expires_in_days = days;
      }

      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create');
      }

      const data: NewKeyResponse = await res.json();

      // Show the new key
      setNewKey(data.key || null);
      setKeys([data, ...keys]);
      setNewKeyName('');
      setExpirationDays('0');
      toast.success(locale === 'zh' ? 'API 密钥已创建' : 'API key created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (locale === 'zh' ? '创建 API 密钥失败' : 'Failed to create API key'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteKeyId) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/api-keys/${deleteKeyId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete');

      setKeys(keys.filter(k => k.id !== deleteKeyId));
      toast.success(locale === 'zh' ? 'API 密钥已删除' : 'API key deleted');
    } catch (err) {
      toast.error(locale === 'zh' ? '删除 API 密钥失败' : 'Failed to delete API key');
    } finally {
      setDeleting(false);
      setDeleteKeyId(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t('settings.copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('settings.never');
    return new Date(dateStr).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US');
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getExpirationLabel = (expiresAt: string | null) => {
    if (!expiresAt) {
      return { text: t('settings.neverExpires'), isExpired: false };
    }
    const expired = isExpired(expiresAt);
    if (expired) {
      return { text: t('settings.expired'), isExpired: true };
    }
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return {
      text: locale === 'zh' ? `${days} 天后过期` : `Expires in ${days} days`,
      isExpired: false
    };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {t('settings.apiKeys')}
            </CardTitle>
            <CardDescription>
              {t('settings.apiKeysDesc')}
            </CardDescription>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {t('settings.createKey')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            {locale === 'zh' ? '加载中...' : 'Loading...'}
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {locale === 'zh' ? '暂无 API 密钥，创建一个开始使用' : 'No API keys yet. Create one to get started.'}
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => {
              const expInfo = getExpirationLabel(key.expires_at);
              return (
                <div
                  key={key.id}
                  className={`flex items-center justify-between p-3 border rounded-lg ${expInfo.isExpired ? 'opacity-50' : ''}`}
                >
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      {key.name}
                      {expInfo.isExpired && (
                        <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">
                          {t('settings.expired')}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {key.key_prefix}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {expInfo.text}
                      </span>
                      <span>
                        {locale === 'zh' ? '最后使用' : 'Last used'}: {formatDate(key.last_used_at)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteKeyId(key.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locale === 'zh' ? '创建 API 密钥' : 'Create API Key'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('settings.keyName')}</label>
              <Input
                placeholder={t('settings.keyNamePlaceholder')}
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {locale === 'zh' ? '给密钥一个描述性名称以便记住其用途' : 'Give your key a descriptive name to remember its purpose'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">{t('settings.expiration')}</label>
              <Select value={expirationDays} onValueChange={setExpirationDays}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label[locale as 'zh' | 'en']}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t('settings.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (locale === 'zh' ? '创建中...' : 'Creating...') : (locale === 'zh' ? '创建' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show New Key Dialog */}
      <Dialog open={!!newKey} onOpenChange={(open) => !open && setNewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              {t('settings.keyCreated')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t('settings.keyCreatedDesc')}
              </p>
            </div>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={newKey || ''}
                readOnly
                className="pr-20 font-mono"
              />
              <div className="absolute right-1 top-1 flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(newKey || '')}
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKey(null)}>{t('settings.done')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteKeyId} onOpenChange={(open) => !open && setDeleteKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{locale === 'zh' ? '删除 API 密钥？' : 'Delete API Key?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {locale === 'zh' ? '此操作无法撤销。使用此密钥的应用将失去访问权限。' : 'This action cannot be undone. Any applications using this key will lose access.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('settings.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (locale === 'zh' ? '删除中...' : 'Deleting...') : t('settings.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
