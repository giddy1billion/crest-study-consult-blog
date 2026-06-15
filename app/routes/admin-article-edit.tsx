import type { Route } from "./+types/admin-article-edit";
import { data, redirect, Form, useNavigation, useActionData, Link, useFetcher } from "react-router";
import { db } from "~/utils/db.server";
import { calculateReadingTime, generateSlug } from "~/utils/helpers";
import { BRAND, SEO_DEFAULTS } from "~/utils/constants";
import type { PostStatus } from "@prisma/client";
import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react";
import { ImagePicker } from "~/components/media";
import { MarkdownEditor } from "~/components/forms";

// ============================================
// Form Data Interface for Auto-Save
// ============================================

interface ArticleFormData {
  title: string;
  excerpt: string;
  content: string;
  categoryId: string;
  authorId: string;
  targetKeyword: string;
  heroImage: string;
  heroImageAlt: string;
  metaTitle: string;
  metaDescription: string;
  isFeatured: boolean;
  commentsEnabled: boolean;
  sourceNotes: string;
  tags: string;
}

/**
 * Edit Article Meta
 */
export function meta({ data }: Route.MetaArgs) {
  const title = data?.article?.title || "Edit Article";
  return [
    { title: `${title} — ${BRAND.name} Admin` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

/**
 * Loader - Get article and form data with optimized transaction
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { id } = params;

  const [article, categories, authors, tags, newsletter] = await db.$transaction([
    db.post.findUnique({
      where: { id },
      include: { category: true, author: true, tags: { select: { id: true, name: true } } },
    }),
    db.category.findMany({ select: { id: true, slug: true, name: true } }),
    db.author.findMany({ select: { id: true, name: true } }),
    db.tag.findMany({ select: { id: true, slug: true, name: true }, orderBy: { name: "asc" } }),
    db.newsletter.findFirst({
      where: { postId: id },
      select: { 
        id: true, 
        subject: true, 
        status: true, 
        sentAt: true, 
        totalSent: true,
        totalOpened: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!article) {
    throw new Response("Not Found", { status: 404 });
  }

  return data(
    { article, categories, authors, tags, newsletter },
    { headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" } }
  );
}

/**
 * Action - Update article
 */
export async function action({ request, params }: Route.ActionArgs) {
  const { id } = params;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    // Editorial cannot delete — only request deletion
    // Article is unpublished and marked for admin review
    await db.post.update({
      where: { id },
      data: { 
        isPublished: false, 
        status: "DELETE_REQUESTED",
      },
    });
    return data({ 
      success: true, 
      message: "Deletion requested. Article unpublished and awaiting admin approval." 
    });
  }

  if (intent === "publish") {
    await db.post.update({
      where: { id },
      data: { isPublished: true, status: "LIVE", publishedAt: new Date() },
    });
    return data({ success: true, message: "Article published successfully" });
  }

  if (intent === "unpublish") {
    await db.post.update({
      where: { id },
      data: { isPublished: false, status: "READY" },
    });
    return data({ success: true, message: "Article unpublished" });
  }

  if (intent === "status") {
    const status = formData.get("status") as PostStatus;
    await db.post.update({ where: { id }, data: { status } });
    return data({ success: true, message: `Status changed to ${status.replace(/_/g, " ")}` });
  }

  if (intent === "create-newsletter") {
    const { createNewsletterFromPost } = await import("~/utils/email.server");
    const article = await db.post.findUnique({
      where: { id },
      select: { title: true },
    });
    
    const newsletter = await createNewsletterFromPost({
      postId: id!,
      subject: article?.title || "New article from Crest Study Consult",
    });
    
    return data({ 
      success: true, 
      message: "Newsletter draft created",
      newsletterId: newsletter.id,
    });
  }

  const title = formData.get("title") as string;
  const categoryId = formData.get("categoryId") as string;
  const authorId = formData.get("authorId") as string;
  const excerpt = formData.get("excerpt") as string;
  const content = formData.get("content") as string;
  const targetKeyword = formData.get("targetKeyword") as string;
  const heroImage = formData.get("heroImage") as string;
  const heroImageAlt = formData.get("heroImageAlt") as string;
  const metaTitle = formData.get("metaTitle") as string;
  const metaDescription = formData.get("metaDescription") as string;
  const isFeatured = formData.get("isFeatured") === "on";
  const commentsEnabled = formData.get("commentsEnabled") === "on";
  const sourceNotes = formData.get("sourceNotes") as string;
  const tagsJson = formData.get("tags") as string;

  const errors: Record<string, string> = {};
  if (!title || title.length < 10) errors.title = "Title must be at least 10 characters";
  if (!excerpt || excerpt.length < 50) errors.excerpt = "Excerpt must be at least 50 characters";
  if (!content || content.length < 100) errors.content = "Content must be at least 100 characters";
  if (Object.keys(errors).length > 0) return data({ success: false, message: "Validation failed", errors }, { status: 400 });

  const category = await db.category.findUnique({ where: { id: categoryId } });
  const currentArticle = await db.post.findUnique({ where: { id } });

  // Parse and handle tags
  let tagConnections: { id: string }[] = [];
  if (tagsJson) {
    try {
      const parsedTags = JSON.parse(tagsJson) as Array<{ id?: string; name: string; isNew?: boolean }>;
      
      for (const tag of parsedTags) {
        if (tag.id && !tag.isNew) {
          // Existing tag - just connect
          tagConnections.push({ id: tag.id });
        } else if (tag.name) {
          // New tag - create it first
          const tagSlug = generateSlug(tag.name);
          const existingTag = await db.tag.findUnique({ where: { slug: tagSlug } });
          
          if (existingTag) {
            tagConnections.push({ id: existingTag.id });
          } else {
            const newTag = await db.tag.create({
              data: { name: tag.name, slug: tagSlug },
            });
            tagConnections.push({ id: newTag.id });
          }
        }
      }
    } catch {
      // Invalid JSON, keep existing tags
    }
  }

  await db.post.update({
    where: { id },
    data: {
      title, categoryId, authorId, excerpt, content,
      targetKeyword: targetKeyword || null,
      heroImage: heroImage || null,
      heroImageAlt: heroImageAlt || null,
      metaTitle: metaTitle || `${title}${SEO_DEFAULTS.titleSuffix}`,
      metaDescription: metaDescription || excerpt.slice(0, 300),
      canonicalURL: `${BRAND.url}/${category?.slug}/${currentArticle?.slug}`,
      readingTimeMin: calculateReadingTime(content),
      isFeatured,
      commentsEnabled,
      sourceNotes: sourceNotes || null,
      // Update tags - disconnect all and reconnect selected ones
      tags: tagsJson ? { set: tagConnections } : undefined,
    },
  });

  return data({ success: true, message: "Changes saved successfully" });
}

// ============================================
// UI Components
// ============================================

const WORKFLOW_STEPS: { status: PostStatus; label: string }[] = [
  { status: "IDEA", label: "Idea" },
  { status: "DRAFT", label: "Draft" },
  { status: "EDITORIAL_REVIEW", label: "Editorial" },
  { status: "SEO_REVIEW", label: "SEO" },
  { status: "FACT_CHECK", label: "Fact Check" },
  { status: "AEO_REVIEW", label: "AEO" },
  { status: "READY", label: "Ready" },
];

function CharacterCounter({ current, max, min }: { current: number; max?: number; min?: number }) {
  const isOverMax = max && current > max;
  const isUnderMin = min && current < min;
  return (
    <span className={`text-xs tabular-nums ${isOverMax ? "text-red-500 font-medium" : isUnderMin ? "text-amber-500" : "text-gray-400"}`}>
      {current}{max ? `/${max}` : ""} {!isOverMax && !isUnderMin && min && current >= min && "✓"}
    </span>
  );
}

// Controlled FormInput with value prop for auto-save
function FormInput({ label, name, type = "text", required, value, onChange, placeholder, maxLength, minLength, error, hint, showCounter }: {
  label: string; name: string; type?: string; required?: boolean; value: string;
  onChange: (value: string) => void; placeholder?: string; maxLength?: number; minLength?: number; 
  error?: string; hint?: string; showCounter?: boolean;
}) {
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        {showCounter && <CharacterCounter current={value.length} max={maxLength} min={minLength} />}
      </div>
      <input type={type} id={name} name={name} required={required} maxLength={maxLength} minLength={minLength}
        value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-2.5 bg-white border rounded-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 ${error ? "border-red-300 bg-red-50/50" : "border-gray-200 hover:border-gray-300"}`}
      />
      {error && <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

// Controlled FormTextarea with value prop for auto-save
function FormTextarea({ label, name, required, value, onChange, placeholder, rows = 3, maxLength, minLength, error, hint, monospace }: {
  label: string; name: string; required?: boolean; value: string; onChange: (value: string) => void;
  placeholder?: string; rows?: number; maxLength?: number; minLength?: number; error?: string; hint?: string; monospace?: boolean;
}) {
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        <CharacterCounter current={value.length} max={maxLength} min={minLength} />
      </div>
      <textarea id={name} name={name} required={required} maxLength={maxLength} minLength={minLength} rows={rows}
        value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-3 bg-white border rounded-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none ${monospace ? "font-mono text-sm leading-relaxed" : ""} ${error ? "border-red-300 bg-red-50/50" : "border-gray-200 hover:border-gray-300"}`}
      />
      {error && <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function FormSelect({ label, name, required, defaultValue, value, onChange, options }: {
  label: string; name: string; required?: boolean; defaultValue?: string; value?: string; onChange?: (e: ChangeEvent<HTMLSelectElement>) => void; options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <select id={name} name={name} required={required} defaultValue={value ? undefined : defaultValue} value={value} onChange={onChange}
        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 transition-all duration-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 hover:border-gray-300 cursor-pointer">
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
}

function Toast({ message, type = "success", onClose }: { message: string; type?: "success" | "error"; onClose: () => void }) {
  useEffect(() => { const timer = setTimeout(onClose, 4000); return () => clearTimeout(timer); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-in scale-in ${type === "success" ? "bg-teal-600 text-white" : "bg-red-600 text-white"}`}>
      {type === "success" ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
    </div>
  );
}

// ============================================
// Tag Input Component
// ============================================

interface TagInputProps {
  availableTags: Array<{ id: string; slug: string; name: string }>;
  selectedTags?: Array<{ id: string; name: string }>;
  onChange?: (tags: Array<{ id?: string; name: string; isNew?: boolean }>) => void;
}

function TagInput({ availableTags, selectedTags = [], onChange }: TagInputProps) {
  const [tags, setTags] = useState<Array<{ id?: string; name: string; isNew?: boolean }>>(
    selectedTags.map(t => ({ id: t.id, name: t.name }))
  );
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Notify parent of tag changes
  const updateTags = useCallback((newTags: Array<{ id?: string; name: string; isNew?: boolean }>) => {
    setTags(newTags);
    onChange?.(newTags);
  }, [onChange]);

  // Filter suggestions based on input
  const suggestions = availableTags.filter(
    tag => 
      tag.name.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.some(t => t.id === tag.id || t.name.toLowerCase() === tag.name.toLowerCase())
  );

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addTag = (tag: { id?: string; name: string; isNew?: boolean }) => {
    if (!tags.some(t => t.name.toLowerCase() === tag.name.toLowerCase())) {
      updateTags([...tags, tag]);
    }
    setInputValue("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeTag = (index: number) => {
    updateTags(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (inputValue.trim()) {
        const existing = availableTags.find(
          t => t.name.toLowerCase() === inputValue.trim().toLowerCase()
        );
        if (existing) {
          addTag({ id: existing.id, name: existing.name });
        } else {
          addTag({ name: inputValue.trim(), isNew: true });
        }
      }
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden input removed - parent component handles form submission */}
      
      <div className="flex flex-wrap gap-2 p-2 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500 bg-white min-h-[42px] hover:border-gray-300 transition-all">
        {tags.map((tag, index) => (
          <span
            key={index}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-sm rounded-lg ${
              tag.isNew 
                ? "bg-amber-50 text-amber-700 border border-amber-200" 
                : "bg-teal-50 text-teal-700 border border-teal-200"
            }`}
          >
            {tag.name}
            {tag.isNew && <span className="text-xs opacity-75">(new)</span>}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="ml-0.5 hover:text-red-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "Add tags..." : ""}
          className="flex-1 min-w-[120px] outline-none text-sm py-1"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (inputValue || suggestions.length > 0) && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-auto">
          {suggestions.length > 0 ? (
            suggestions.slice(0, 10).map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => addTag({ id: tag.id, name: tag.name })}
                className="w-full px-3 py-2 text-left text-sm hover:bg-teal-50 flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl"
              >
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                {tag.name}
              </button>
            ))
          ) : inputValue.trim() ? (
            <button
              type="button"
              onClick={() => addTag({ name: inputValue.trim(), isNew: true })}
              className="w-full px-3 py-2 text-left text-sm hover:bg-amber-50 flex items-center gap-2 rounded-xl"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Create "{inputValue.trim()}"
            </button>
          ) : null}
        </div>
      )}
      
      <p className="mt-1.5 text-xs text-gray-500">
        Type to search existing tags or create new ones. Press Enter to add.
      </p>
    </div>
  );
}

/**
 * Edit Article Form Component - Modern UI/UX with Auto-Save
 */
export default function AdminArticleEdit({ loaderData }: Route.ComponentProps) {
  const { article, categories, authors, tags: availableTags, newsletter } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const autoSaveFetcher = useFetcher<typeof action>();
  const newsletterFetcher = useFetcher<typeof action>();
  const [activeTab, setActiveTab] = useState<"content" | "seo" | "settings">("content");
  const [showToast, setShowToast] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Extract validation errors from action data (if present)
  const validationErrors = actionData && "errors" in actionData 
    ? (actionData.errors as Record<string, string>) 
    : undefined;
  
  // ============================================
  // Centralized Form State - Persists Across Tabs
  // ============================================
  const [formData, setFormData] = useState<ArticleFormData>({
    title: article.title,
    excerpt: article.excerpt,
    content: article.content,
    categoryId: article.categoryId,
    authorId: article.authorId,
    targetKeyword: article.targetKeyword || "",
    heroImage: article.heroImage || "",
    heroImageAlt: article.heroImageAlt || "",
    metaTitle: article.metaTitle || "",
    metaDescription: article.metaDescription || "",
    isFeatured: article.isFeatured,
    commentsEnabled: article.commentsEnabled,
    sourceNotes: article.sourceNotes || "",
    tags: JSON.stringify(article.tags.map(t => ({ id: t.id, name: t.name }))),
  });
  
  // Track if form has unsaved changes
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Save status: "idle" | "saving" | "saved" | "error"
  // Priority: submitting > error > hasChanges (unsaved) > success (saved) > idle
  const saveStatus = autoSaveFetcher.state === "submitting" ? "saving" 
    : autoSaveFetcher.data?.success === false ? "error"
    : hasChanges ? "unsaved" 
    : autoSaveFetcher.data?.success ? "saved"
    : "idle";
  
  // Check if content meets minimum requirements for auto-save
  const meetsAutoSaveRequirements = formData.title.length >= 10 && formData.excerpt.length >= 50 && formData.content.length >= 100;

  // Helper to update a single field
  const updateField = useCallback(<K extends keyof ArticleFormData>(
    field: K, 
    value: ArticleFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  // ============================================
  // Auto-Save with 3-Second Debounce
  // ============================================
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Only auto-save if there are changes and minimum content requirements are met
    if (!hasChanges) return;
    if (formData.title.length < 10 || formData.excerpt.length < 50 || formData.content.length < 100) return;
    
    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Set new timeout for 3 seconds
    autoSaveTimeoutRef.current = setTimeout(() => {
      const fd = new FormData();
      fd.append("title", formData.title);
      fd.append("excerpt", formData.excerpt);
      fd.append("content", formData.content);
      fd.append("categoryId", formData.categoryId);
      fd.append("authorId", formData.authorId);
      fd.append("targetKeyword", formData.targetKeyword);
      fd.append("heroImage", formData.heroImage);
      fd.append("heroImageAlt", formData.heroImageAlt);
      fd.append("metaTitle", formData.metaTitle);
      fd.append("metaDescription", formData.metaDescription);
      fd.append("isFeatured", formData.isFeatured ? "on" : "");
      fd.append("commentsEnabled", formData.commentsEnabled ? "on" : "");
      fd.append("sourceNotes", formData.sourceNotes);
      fd.append("tags", formData.tags);
      
      autoSaveFetcher.submit(fd, { method: "post" });
    }, 3000);
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formData, hasChanges, autoSaveFetcher]);
  
  // Update lastSaved and reset hasChanges on successful auto-save
  useEffect(() => {
    if (autoSaveFetcher.data?.success) {
      setHasChanges(false);
      setLastSaved(new Date());
    }
  }, [autoSaveFetcher.data]);

  // Show toast on manual save success
  useEffect(() => { if (actionData?.success) setShowToast(true); }, [actionData]);

  // Keyboard shortcut: Ctrl/Cmd + S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const currentStepIndex = WORKFLOW_STEPS.findIndex((s) => s.status === article.status);

  const tabs = [
    { id: "content" as const, label: "Content", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    { id: "seo" as const, label: "SEO & Meta", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> },
    { id: "settings" as const, label: "Settings", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {showToast && actionData && "message" in actionData && <Toast message={actionData.message} type={actionData.success ? "success" : "error"} onClose={() => setShowToast(false)} />}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link to="/admin/articles" className="hover:text-teal-600 transition-colors">Articles</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-gray-900 font-medium truncate max-w-[200px]">{formData.title || article.title}</span>
          
          {/* Auto-Save Status Indicator */}
          <span className="ml-auto flex items-center gap-1.5">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-amber-600">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-xs font-medium">Saving...</span>
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-teal-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-medium">Saved {lastSaved && `at ${lastSaved.toLocaleTimeString()}`}</span>
              </span>
            )}
            {saveStatus === "unsaved" && (
              <span className="flex items-center gap-1.5 text-gray-500">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs">
                  {meetsAutoSaveRequirements ? "Unsaved changes" : "Auto-save paused (min: title 10, excerpt 50, content 100 chars)"}
                </span>
              </span>
            )}
            {saveStatus === "error" && (
              <span className="flex items-center gap-1.5 text-red-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-medium">Save failed</span>
              </span>
            )}
          </span>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit article</h1>
            <p className="mt-1 text-sm text-gray-500 flex items-center gap-2">
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">/{article.category.slug}/{article.slug}</span>
              <span className="text-gray-300">|</span><span>{article.readingTimeMin || 1} min read</span>
              <span className="text-gray-300">|</span><span>{article.viewCount || 0} views</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {article.isPublished ? (
              <>
                <a href={`/${article.category.slug}/${article.slug}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>View live
                </a>
                <Form method="post"><input type="hidden" name="intent" value="unpublish" />
                  <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-all disabled:opacity-50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>Unpublish
                  </button>
                </Form>
              </>
            ) : (
              <Form method="post"><input type="hidden" name="intent" value="publish" />
                <button type="submit" disabled={isSubmitting || article.status !== "READY"}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-navy-700 rounded-xl hover:bg-navy-800 shadow-lg shadow-navy-700/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Publish
                </button>
              </Form>
            )}
          </div>
        </div>
      </div>

      {/* Workflow Status */}
      <div className="mb-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Workflow status</span>
          {article.isPublished && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-medium rounded-full"><span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />Live</span>}
        </div>
        <div className="flex items-center gap-1">
          {WORKFLOW_STEPS.map((step, index) => {
            const isCurrent = step.status === article.status;
            const isPast = index < currentStepIndex;
            return (
              <div key={step.status} className="flex-1 flex items-center">
                <Form method="post" className="flex-1"><input type="hidden" name="intent" value="status" /><input type="hidden" name="status" value={step.status} />
                  <button type="submit" disabled={article.isPublished || isSubmitting}
                    className={`w-full py-2 px-2 text-xs font-medium rounded-lg transition-all ${isCurrent ? "bg-teal-100 text-teal-700 ring-2 ring-teal-500 ring-offset-1" : isPast ? "bg-teal-50 text-teal-600" : "bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600"} ${article.isPublished ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                    {step.label}
                  </button>
                </Form>
                {index < WORKFLOW_STEPS.length - 1 && <div className={`w-2 h-0.5 mx-0.5 ${isPast ? "bg-teal-300" : "bg-gray-200"}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Form */}
      <Form ref={formRef} method="post">
        {/* Hidden inputs to persist ALL form data for manual submit */}
        <input type="hidden" name="title" value={formData.title} />
        <input type="hidden" name="excerpt" value={formData.excerpt} />
        <input type="hidden" name="content" value={formData.content} />
        <input type="hidden" name="categoryId" value={formData.categoryId} />
        <input type="hidden" name="authorId" value={formData.authorId} />
        <input type="hidden" name="targetKeyword" value={formData.targetKeyword} />
        <input type="hidden" name="heroImage" value={formData.heroImage} />
        <input type="hidden" name="heroImageAlt" value={formData.heroImageAlt} />
        <input type="hidden" name="metaTitle" value={formData.metaTitle} />
        <input type="hidden" name="metaDescription" value={formData.metaDescription} />
        <input type="hidden" name="isFeatured" value={formData.isFeatured ? "on" : ""} />
        <input type="hidden" name="commentsEnabled" value={formData.commentsEnabled ? "on" : ""} />
        <input type="hidden" name="sourceNotes" value={formData.sourceNotes} />
        <input type="hidden" name="tags" value={formData.tags} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="border-b border-gray-100 px-4">
                <nav className="flex gap-1" aria-label="Tabs">
                  {tabs.map((tab) => (
                    <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.id ? "border-teal-500 text-teal-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}>
                      {tab.icon}{tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-6">
                {activeTab === "content" && (
                  <div className="space-y-6">
                    <FormInput label="Title" name="_title" required value={formData.title} onChange={(v) => updateField("title", v)} maxLength={80} minLength={10} showCounter error={validationErrors?.title} hint="Clear, descriptive headline (10-80 characters)" />
                    <FormTextarea label="Excerpt" name="_excerpt" required value={formData.excerpt} onChange={(v) => updateField("excerpt", v)} rows={3} maxLength={300} minLength={50} error={validationErrors?.excerpt} hint="Brief summary for article cards and meta description" />
                    <MarkdownEditor name="_content" label="Content" required value={formData.content} onChange={(v) => updateField("content", v)} rows={20} minLength={100} error={validationErrors?.content} hint="Markdown supported. Click the image icon to insert images." />
                  </div>
                )}

                {activeTab === "seo" && (
                  <div className="space-y-6">
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <div><h4 className="text-sm font-medium text-blue-900">Search preview</h4><p className="mt-1 text-xs text-blue-700">How your article may appear in search results</p></div>
                      </div>
                      <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                        <p className="text-sm text-teal-700 truncate">blog.creststudyconsult.com › {article.category.slug}</p>
                        <h3 className="text-lg text-blue-800 hover:underline cursor-pointer truncate">{formData.metaTitle || formData.title}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2">{formData.metaDescription || formData.excerpt}</p>
                      </div>
                    </div>
                    <FormInput label="Meta title" name="_metaTitle" value={formData.metaTitle} onChange={(v) => updateField("metaTitle", v)} maxLength={100} showCounter hint="50-100 characters. Include 'Crest Study Consult' for brand consistency" />
                    <FormTextarea label="Meta description" name="_metaDescription" value={formData.metaDescription} onChange={(v) => updateField("metaDescription", v)} rows={3} maxLength={300} minLength={120} hint="150-300 characters. Compelling summary for search results" />
                    <FormInput label="Target keyword" name="_targetKeyword" value={formData.targetKeyword} onChange={(v) => updateField("targetKeyword", v)} placeholder="e.g., property verification Lagos" hint="Primary keyword this article should rank for" />
                    
                    {/* Hero Image Picker */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Hero image</label>
                      <ImagePicker
                        value={formData.heroImage}
                        onChange={(url, alt) => {
                          updateField("heroImage", url);
                          if (alt) updateField("heroImageAlt", alt);
                        }}
                        folder="HERO_IMAGES"
                        placeholder="Select or upload hero image"
                        recommendedSize={{ width: 1200, height: 630 }}
                        showAltInput
                        altValue={formData.heroImageAlt}
                        onAltChange={(alt) => updateField("heroImageAlt", alt)}
                      />
                      <p className="mt-1.5 text-xs text-gray-500">1200×630px recommended for optimal display on social media</p>
                    </div>
                  </div>
                )}

                {activeTab === "settings" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormSelect label="Category" name="_categoryId" required value={formData.categoryId} onChange={(e) => updateField("categoryId", e.target.value)} options={categories.map((cat) => ({ value: cat.id, label: cat.name }))} />
                      <FormSelect label="Author" name="_authorId" required value={formData.authorId} onChange={(e) => updateField("authorId", e.target.value)} options={authors.map((a) => ({ value: a.id, label: a.name }))} />
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                      <TagInput 
                        availableTags={availableTags} 
                        selectedTags={article.tags}
                        onChange={(tags) => updateField("tags", JSON.stringify(tags))}
                      />
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.isFeatured} onChange={(e) => updateField("isFeatured", e.target.checked)} className="w-5 h-5 text-teal-600 border-gray-300 rounded focus:ring-teal-500" />
                        <div><span className="text-sm font-medium text-gray-900">Featured article</span><p className="text-xs text-gray-500">Appears in homepage hero section and featured lists</p></div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.commentsEnabled} onChange={(e) => updateField("commentsEnabled", e.target.checked)} className="w-5 h-5 text-teal-600 border-gray-300 rounded focus:ring-teal-500" />
                        <div><span className="text-sm font-medium text-gray-900">Enable comments</span><p className="text-xs text-gray-500">Allow readers to comment on this article</p></div>
                      </label>
                    </div>
                    <FormTextarea label="Source notes" name="_sourceNotes" value={formData.sourceNotes} onChange={(v) => updateField("sourceNotes", v)} rows={4} placeholder="List all data sources and references..." hint="Internal notes for editorial team. Not displayed publicly" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Actions</h3>
              <div className="space-y-3">
                <button type="submit" disabled={isSubmitting || saveStatus === "saving"}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-navy-700 text-white text-sm font-medium rounded-xl hover:bg-navy-800 shadow-lg shadow-navy-700/25 transition-all disabled:opacity-50">
                  {isSubmitting ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Saving...</>
                    : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Save changes</>}
                </button>
                <Link to="/admin/articles" className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-all">Cancel</Link>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Article info</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Updated</dt><dd className="text-gray-900">{new Date(article.updatedAt).toLocaleDateString()}</dd></div>
                {article.publishedAt && <div className="flex justify-between"><dt className="text-gray-500">Published</dt><dd className="text-gray-900">{new Date(article.publishedAt).toLocaleDateString()}</dd></div>}
                <div className="flex justify-between"><dt className="text-gray-500">Reading time</dt><dd className="text-gray-900">{article.readingTimeMin || 1} min</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Views</dt><dd className="text-gray-900">{article.viewCount || 0}</dd></div>
              </dl>
            </div>

            {/* Newsletter Section */}
            {article.isPublished && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-blue-900">Newsletter</h3>
                </div>
                
                {newsletter ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        newsletter.status === "SENT" 
                          ? "bg-emerald-100 text-emerald-700" 
                          : newsletter.status === "SCHEDULED"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {newsletter.status === "SENT" ? "Sent" : newsletter.status === "SCHEDULED" ? "Scheduled" : "Draft"}
                      </span>
                      {newsletter.status === "SENT" && newsletter.totalSent > 0 && (
                        <span className="text-xs text-gray-500">
                          {newsletter.totalSent} sent • {newsletter.totalOpened} opens
                        </span>
                      )}
                    </div>
                    <Link 
                      to={`/admin/newsletter/${newsletter.id}`}
                      className="block w-full text-center px-4 py-2 text-sm font-medium text-blue-700 bg-white rounded-xl border border-blue-200 hover:bg-blue-50 transition-all"
                    >
                      {newsletter.status === "SENT" ? "View analytics" : "Edit newsletter"}
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-blue-700">
                      Send this article to all newsletter subscribers
                    </p>
                    <newsletterFetcher.Form method="post">
                      <input type="hidden" name="intent" value="create-newsletter" />
                      <button
                        type="submit"
                        disabled={newsletterFetcher.state !== "idle"}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
                      >
                        {newsletterFetcher.state !== "idle" ? (
                          <>
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Creating...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Create newsletter
                          </>
                        )}
                      </button>
                    </newsletterFetcher.Form>
                  </div>
                )}
              </div>
            )}

            <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
              <h3 className="text-sm font-semibold text-amber-900 mb-2">Request deletion</h3>
              <p className="text-xs text-amber-600 mb-4">Article will be unpublished and flagged for admin review</p>
              <Form method="post" onSubmit={(e) => { if (!confirm("Request deletion? The article will be unpublished and flagged for admin review.")) e.preventDefault(); }}>
                <input type="hidden" name="intent" value="delete" />
                <button type="submit" disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-amber-600 text-sm font-medium rounded-xl border border-amber-200 hover:bg-amber-50 hover:border-amber-300 transition-all disabled:opacity-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>Request deletion
                </button>
              </Form>
            </div>

            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Keyboard shortcuts</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center"><span className="text-gray-600">Save changes</span><kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-gray-500">⌘S</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-600">Bold text</span><kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-gray-500">⌘B</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-600">Italic text</span><kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-gray-500">⌘I</kbd></div>
              </div>
            </div>
          </div>
        </div>
      </Form>
    </div>
  );
}
