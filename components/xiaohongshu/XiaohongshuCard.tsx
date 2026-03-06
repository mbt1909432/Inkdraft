'use client';

import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Copy, Download, Check, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';

export interface XiaohongshuContent {
  title: string;
  tags: string[];
  cards: Array<{ content: string }>;
}

interface XiaohongshuCardProps {
  data: XiaohongshuContent;
  onRegenerate?: () => void;
  className?: string;
}

export function XiaohongshuCard({ data, onRegenerate, className }: XiaohongshuCardProps) {
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [currentCard, setCurrentCard] = useState(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Copy title
  const handleCopyTitle = async () => {
    await navigator.clipboard.writeText(data.title);
    setCopiedTitle(true);
    toast.success('标题已复制');
    setTimeout(() => setCopiedTitle(false), 2000);
  };

  // Copy tags
  const handleCopyTags = async () => {
    const tagsText = data.tags.map(t => `#${t}`).join(' ');
    await navigator.clipboard.writeText(tagsText);
    setCopiedTags(true);
    toast.success('标签已复制');
    setTimeout(() => setCopiedTags(false), 2000);
  };

  // Download single card as image
  const handleDownloadCard = async (index: number) => {
    const cardEl = cardRefs.current[index];
    if (!cardEl) return;

    setDownloading(index);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardEl, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
      });

      const link = document.createElement('a');
      link.download = `xiaohongshu-${index + 1}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success(`卡片 ${index + 1} 已下载`);
    } catch (error) {
      console.error('Failed to download image:', error);
      toast.error('下载失败，请重试');
    } finally {
      setDownloading(null);
    }
  };

  // Download all cards as zip
  const handleDownloadAll = async () => {
    setDownloading(-1); // Use -1 to indicate "all"
    try {
      const html2canvas = (await import('html2canvas')).default;
      const zip = new JSZip();

      for (let i = 0; i < data.cards.length; i++) {
        const cardEl = cardRefs.current[i];
        if (!cardEl) continue;

        const canvas = await html2canvas(cardEl, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          allowTaint: true,
        });

        // Convert canvas to blob
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/png');
        });

        zip.file(`xiaohongshu-${i + 1}.png`, blob);
      }

      // Generate and download zip
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.download = `xiaohongshu-cards-${Date.now()}.zip`;
      link.href = URL.createObjectURL(zipBlob);
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success(`已下载 ${data.cards.length} 张卡片`);
    } catch (error) {
      console.error('Failed to download images:', error);
      toast.error('下载失败，请重试');
    } finally {
      setDownloading(null);
    }
  };

  // Navigate cards
  const goToPrev = () => {
    setCurrentCard(prev => (prev > 0 ? prev - 1 : data.cards.length - 1));
  };

  const goToNext = () => {
    setCurrentCard(prev => (prev < data.cards.length - 1 ? prev + 1 : 0));
  };

  // Calculate font size based on content length
  const getFontSize = (content: string): string => {
    const len = content.length;
    if (len <= 10) return 'text-5xl md:text-6xl';
    if (len <= 20) return 'text-4xl md:text-5xl';
    if (len <= 35) return 'text-3xl md:text-4xl';
    if (len <= 50) return 'text-2xl md:text-3xl';
    if (len <= 80) return 'text-xl md:text-2xl';
    if (len <= 120) return 'text-lg md:text-xl';
    return 'text-base md:text-lg';
  };

  // Calculate line height based on content length
  const getLineHeight = (content: string): string => {
    const len = content.length;
    if (len <= 20) return 'leading-relaxed';
    if (len <= 60) return 'leading-relaxed';
    return 'leading-normal';
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Title row */}
      <div className="flex items-center gap-2">
        <span className="font-medium text-base">{data.title}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyTitle}
          className="h-7 px-2"
        >
          {copiedTitle ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Tags row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1.5">
          {data.tags.map((tag, index) => (
            <span
              key={index}
              className="text-xs text-pink-500 bg-pink-50 dark:bg-pink-950 dark:text-pink-400 px-2 py-0.5 rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyTags}
          className="h-7 px-2"
        >
          {copiedTags ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Card carousel */}
      <div className="relative">
        {/* Navigation buttons */}
        {data.cards.length > 1 && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 h-8 w-8 rounded-full bg-background shadow-md"
              onClick={goToPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 h-8 w-8 rounded-full bg-background shadow-md"
              onClick={goToNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Cards container */}
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${currentCard * 100}%)` }}
          >
            {data.cards.map((card, index) => (
              <div
                key={index}
                className="w-full flex-shrink-0 px-1"
                ref={el => { cardRefs.current[index] = el; }}
              >
                {/* Card preview - 3:4 ratio with beautiful styling */}
                <div
                  className="relative bg-gradient-to-br from-pink-100 via-rose-50 to-orange-100 rounded-xl aspect-[3/4] flex items-center justify-center p-10 overflow-hidden"
                  style={{
                    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif',
                    letterSpacing: '0.05em',
                  }}
                >
                  {/* Decorative elements */}
                  <div className="absolute top-6 right-6 w-20 h-20 bg-pink-300/40 rounded-full blur-2xl" />
                  <div className="absolute bottom-8 left-6 w-24 h-24 bg-orange-200/40 rounded-full blur-2xl" />
                  <div className="absolute top-1/3 left-4 w-12 h-12 bg-rose-200/30 rounded-full blur-xl" />

                  {/* Content */}
                  <p className={cn(
                    'text-center font-semibold text-gray-800 whitespace-pre-line',
                    getFontSize(card.content),
                    getLineHeight(card.content)
                  )}
                  style={{ lineHeight: '2' }}
                  >
                    {card.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card indicators */}
        {data.cards.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {data.cards.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentCard(index)}
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-all',
                  index === currentCard
                    ? 'bg-pink-500 scale-110'
                    : 'bg-gray-300 dark:bg-gray-600 hover:bg-pink-300'
                )}
              />
            ))}
          </div>
        )}

        {/* Card counter */}
        <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2 font-medium">
          {currentCard + 1} / {data.cards.length}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDownloadCard(currentCard)}
          disabled={downloading !== null}
          className="gap-1.5"
        >
          {downloading === currentCard ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {downloading === currentCard ? '生成中...' : '下载当前'}
        </Button>
        {data.cards.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            disabled={downloading !== null}
            className="gap-1.5"
          >
            {downloading !== null ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            下载全部
          </Button>
        )}
        {onRegenerate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            className="gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            重新生成
          </Button>
        )}
      </div>
    </div>
  );
}
