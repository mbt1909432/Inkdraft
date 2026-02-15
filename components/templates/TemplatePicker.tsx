'use client';

import { useState } from 'react';
import { useTranslations } from '@/contexts/LocaleContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  documentTemplates,
  templateCategories,
  getTemplatesByCategory,
  type DocumentTemplate,
  type TemplateCategory,
} from '@/lib/templates';
import { GraduationCap, Briefcase, PenTool, Heart, Check } from 'lucide-react';

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: DocumentTemplate) => void;
}

const categoryIcons: Record<TemplateCategory, React.ReactNode> = {
  academic: <GraduationCap className="h-4 w-4" />,
  business: <Briefcase className="h-4 w-4" />,
  creative: <PenTool className="h-4 w-4" />,
  life: <Heart className="h-4 w-4" />,
};

export function TemplatePicker({ open, onOpenChange, onSelect }: TemplatePickerProps) {
  const t = useTranslations();
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('academic');
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);

  const templates = getTemplatesByCategory(selectedCategory);

  const handleSelect = () => {
    if (selectedTemplate) {
      onSelect(selectedTemplate);
      onOpenChange(false);
      setSelectedTemplate(null);
    }
  };

  const handleBlankDocument = () => {
    onOpenChange(false);
    setSelectedTemplate(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>选择模板创建文档</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row flex-1 min-h-0">
          {/* Category sidebar */}
          <div className="sm:w-48 border-b sm:border-b-0 sm:border-r bg-muted/30 p-2">
            <div className="flex sm:flex-col gap-1">
              {(Object.keys(templateCategories) as TemplateCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors w-full text-left',
                    selectedCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  {categoryIcons[cat]}
                  <span className="hidden sm:inline">{templateCategories[cat].nameZh}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Template list */}
          <div className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 p-4">
              <div className="grid gap-3">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                      'hover:border-primary hover:bg-muted/50',
                      selectedTemplate?.id === template.id && 'border-primary bg-primary/5 ring-1 ring-primary'
                    )}
                  >
                    <span className="text-2xl">{template.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{template.nameZh}</h3>
                        {selectedTemplate?.id === template.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {template.descriptionZh}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>

            {/* Footer actions */}
            <div className="p-4 border-t flex justify-between items-center bg-muted/30">
              <Button variant="ghost" onClick={handleBlankDocument}>
                空白文档
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button onClick={handleSelect} disabled={!selectedTemplate}>
                  使用此模板
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
