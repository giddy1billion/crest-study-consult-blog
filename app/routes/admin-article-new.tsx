import type { Route } from "./+types/admin-article-new";
import { data, redirect, Form, useNavigation, useActionData } from "react-router";
import { db } from "~/utils/db.server";
import { calculateReadingTime, generateSlug } from "~/utils/helpers";
import { BRAND, CATEGORIES } from "~/utils/constants";
import { useState, useEffect, useRef, type ChangeEvent, type DragEvent } from "react";

// Image item type for content images
interface ContentImage {
  id: string;
  url: string;
  alt: string;
  dimensions: { width: number; height: number } | null;
}

// Image alignment options
type ImageAlignment = 'left' | 'center' | 'right' | 'full';

/**
 * New Article Meta
 */
export function meta() {
  return [
    { title: `New Article — ${BRAND.name} Admin` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

/**
 * Loader - Get categories and authors for form
 */
export async function loader({}: Route.LoaderArgs) {
  // Use transaction for connection reuse
  const [categories, authors] = await db.$transaction([
    db.category.findMany({ select: { id: true, slug: true, name: true } }),
    db.author.findMany({ select: { id: true, name: true } }),
  ]);

  return data(
    { categories, authors },
    {
      headers: {
        // Admin pages: no caching for fresh data
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    }
  );
}

/**
 * Action - Create new article
 */
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  
  const title = formData.get("title") as string;
  const categoryId = formData.get("categoryId") as string;
  const authorId = formData.get("authorId") as string;
  const excerpt = formData.get("excerpt") as string;
  const content = formData.get("content") as string;
  const targetKeyword = formData.get("targetKeyword") as string;
  const heroImage = formData.get("heroImage") as string;
  const heroImageAlt = formData.get("heroImageAlt") as string;
  
  // Validation
  const errors: Record<string, string> = {};
  
  if (!title || title.length < 10) {
    errors.title = "Title must be at least 10 characters";
  }
  if (!categoryId) {
    errors.categoryId = "Category is required";
  }
  if (!authorId) {
    errors.authorId = "Author is required";
  }
  if (!excerpt || excerpt.length < 50) {
    errors.excerpt = "Excerpt must be at least 50 characters";
  }
  if (!content || content.length < 100) {
    errors.content = "Content must be at least 100 characters";
  }

  if (Object.keys(errors).length > 0) {
    return data({ errors }, { status: 400 });
  }

  // Generate slug
  const slug = generateSlug(title);

  // Check slug uniqueness
  const existing = await db.post.findUnique({ where: { slug } });
  if (existing) {
    return data({ errors: { slug: "An article with this slug already exists" } }, { status: 400 });
  }

  // Get category for canonical URL
  const category = await db.category.findUnique({ where: { id: categoryId } });

  // Create article
  const article = await db.post.create({
    data: {
      slug,
      title,
      categoryId,
      authorId,
      excerpt,
      content,
      targetKeyword: targetKeyword || null,
      heroImage: heroImage || null,
      heroImageAlt: heroImageAlt || null,
      metaTitle: `${title} — ${BRAND.name}`,
      metaDescription: excerpt.slice(0, 160),
      canonicalURL: `${BRAND.url}/${category?.slug}/${slug}`,
      readingTimeMin: calculateReadingTime(content),
      status: "DRAFT",
    },
  });

  return redirect(`/admin/articles/${article.id}/edit`);
}

/**
 * New Article Form Component
 * Modern UI/UX with real-time validation and previews
 */
export default function AdminArticleNew({ loaderData }: Route.ComponentProps) {
  const { categories, authors } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Form state for real-time features
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [heroImage, setHeroImage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Content textarea ref for cursor position
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // HTML snippets for quick insertion
  const htmlSnippets = {
    h2: { label: '<h2>', snippet: '<h2>Section Heading</h2>\n', description: 'Main section heading' },
    h3: { label: '<h3>', snippet: '<h3>Subsection Heading</h3>\n', description: 'Subsection heading' },
    p: { label: '<p>', snippet: '<p>Your paragraph text here...</p>\n', description: 'Paragraph' },
    ul: { label: '<ul><li>', snippet: '<ul>\n  <li>First item</li>\n  <li>Second item</li>\n  <li>Third item</li>\n</ul>\n', description: 'Bullet list' },
    blockquote: { label: '<blockquote>', snippet: '<blockquote>\n  <p>Key insight or notable quote here.</p>\n</blockquote>\n', description: 'Quote block' },
    strong: { label: '<strong>', snippet: '<strong>bold text</strong>', description: 'Bold text' },
    a: { label: '<a>', snippet: '<a href="https://">link text</a>', description: 'Hyperlink' },
  };

  // Insert HTML snippet at cursor position
  const insertSnippet = (key: keyof typeof htmlSnippets) => {
    const textarea = contentRef.current;
    if (!textarea) return;

    const snippet = htmlSnippets[key].snippet;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.slice(0, start) + snippet + content.slice(end);
    
    setContent(newContent);
    
    // Focus and set cursor position after the inserted snippet
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + snippet.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Derived values
  const slug = generateSlug(title);
  const titleLength = title.length;
  const excerptWords = excerpt.trim().split(/\s+/).filter(Boolean).length;
  const excerptLength = excerpt.length;
  const contentLength = content.length;
  const estimatedReadTime = Math.max(1, Math.ceil(content.split(/\s+/).filter(Boolean).length / 200));
  const categorySlug = categories.find(c => c.id === selectedCategory)?.slug || "category";

  // Form completion progress
  const requiredFields = [title.length >= 10, selectedCategory, excerpt.length >= 50, content.length >= 100];
  const completedFields = requiredFields.filter(Boolean).length;
  const progress = (completedFields / requiredFields.length) * 100;

  // Image preview validation
  const [imageValid, setImageValid] = useState<boolean | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageSource, setImageSource] = useState<'url' | 'upload'>('url');
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Content images state
  const [contentImages, setContentImages] = useState<ContentImage[]>([]);
  const [contentImageUrl, setContentImageUrl] = useState("");
  const [contentImageAlt, setContentImageAlt] = useState("");
  const [contentImageLoading, setContentImageLoading] = useState(false);
  const [contentImageSource, setContentImageSource] = useState<'url' | 'upload'>('url');
  const contentImageInputRef = useRef<HTMLInputElement>(null);

  // Image insertion dropdown state
  const [insertingImageId, setInsertingImageId] = useState<string | null>(null);

  // Preview modal state
  const [showPreview, setShowPreview] = useState(false);

  // Handle file upload
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setImageValid(false);
      return;
    }

    setImageLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setHeroImage(dataUrl);
        setImageDimensions({ width: img.width, height: img.height });
        setImageValid(true);
        setImageLoading(false);
      };
      img.onerror = () => {
        setImageValid(false);
        setImageLoading(false);
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setImageValid(false);
      setImageLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // Handle drag and drop
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setImageSource('upload');
      handleFileUpload(file);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const clearImage = () => {
    setHeroImage('');
    setImageValid(null);
    setImageDimensions(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Content image handlers
  const addContentImageFromUrl = () => {
    if (!contentImageUrl) return;
    
    setContentImageLoading(true);
    const img = new Image();
    img.onload = () => {
      const newImage: ContentImage = {
        id: `img-${Date.now()}`,
        url: contentImageUrl,
        alt: contentImageAlt || 'Article image',
        dimensions: { width: img.width, height: img.height },
      };
      setContentImages([...contentImages, newImage]);
      setContentImageUrl('');
      setContentImageAlt('');
      setContentImageLoading(false);
    };
    img.onerror = () => {
      setContentImageLoading(false);
      alert('Unable to load image. Please check the URL.');
    };
    img.src = contentImageUrl;
  };

  const handleContentImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    setContentImageLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const newImage: ContentImage = {
          id: `img-${Date.now()}`,
          url: dataUrl,
          alt: contentImageAlt || file.name.replace(/\.[^/.]+$/, ''),
          dimensions: { width: img.width, height: img.height },
        };
        setContentImages([...contentImages, newImage]);
        setContentImageAlt('');
        setContentImageLoading(false);
        if (contentImageInputRef.current) {
          contentImageInputRef.current.value = '';
        }
      };
      img.onerror = () => setContentImageLoading(false);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const removeContentImage = (id: string) => {
    setContentImages(contentImages.filter(img => img.id !== id));
  };

  const insertImageIntoContent = (image: ContentImage, alignment: ImageAlignment = 'center') => {
    const textarea = contentRef.current;
    if (!textarea) return;

    // Generate style based on alignment
    const alignmentStyles: Record<ImageAlignment, string> = {
      left: 'style="float: left; margin: 0 1.5rem 1rem 0; max-width: 50%;"',
      center: 'style="display: block; margin: 1.5rem auto; max-width: 100%;"',
      right: 'style="float: right; margin: 0 0 1rem 1.5rem; max-width: 50%;"',
      full: 'style="display: block; width: 100%; margin: 1.5rem 0;"',
    };

    const imgTag = `<figure ${alignmentStyles[alignment]}>
  <img src="${image.url}" alt="${image.alt}" />
  <figcaption>${image.alt}</figcaption>
</figure>
`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.slice(0, start) + imgTag + content.slice(end);
    
    setContent(newContent);
    setInsertingImageId(null);
    
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + imgTag.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const copyImageTag = (image: ContentImage) => {
    const imgTag = `<img src="${image.url}" alt="${image.alt}" />`;
    navigator.clipboard.writeText(imgTag);
  };

  useEffect(() => {
    // Skip validation for uploaded images (already handled in handleFileUpload)
    if (!heroImage || imageSource === 'upload') {
      if (!heroImage) {
        setImageValid(null);
        setImageDimensions(null);
      }
      return;
    }
    setImageLoading(true);
    const img = new Image();
    img.onload = () => { 
      setImageValid(true); 
      setImageLoading(false);
      setImageDimensions({ width: img.width, height: img.height });
    };
    img.onerror = () => { 
      setImageValid(false); 
      setImageLoading(false);
      setImageDimensions(null);
    };
    img.src = heroImage;
  }, [heroImage, imageSource]);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header with Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New Article</h1>
            <p className="mt-1 text-sm text-gray-500">
              Fill in the details below to create a new draft article
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-gray-500">Form completion</p>
              <p className="text-sm font-semibold text-gray-900">{completedFields}/4 required</p>
            </div>
            <div className="w-16 h-16 relative">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                <circle 
                  cx="18" cy="18" r="15.5" fill="none" 
                  stroke={progress === 100 ? "#10B981" : "#6366F1"} 
                  strokeWidth="3" 
                  strokeDasharray={`${progress}, 100`}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Errors */}
      {actionData?.errors?.slug && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-800">Duplicate slug detected</p>
            <p className="text-sm text-red-600 mt-1">{actionData.errors.slug}</p>
          </div>
        </div>
      )}

      <Form method="post" className="space-y-8">
        {/* Section 1: Basic Information */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Basic Information</h2>
                <p className="text-xs text-gray-500">Title, category, and author details</p>
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Title Field */}
            <div className="relative">
              <label 
                htmlFor="title" 
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  focusedField === 'title' || title 
                    ? '-top-2.5 text-xs bg-white px-1 text-indigo-600 font-medium' 
                    : 'top-3 text-sm text-gray-500'
                }`}
              >
                Article Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                minLength={10}
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={() => setFocusedField('title')}
                onBlur={() => setFocusedField(null)}
                className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 outline-none ${
                  actionData?.errors?.title 
                    ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                    : focusedField === 'title'
                    ? 'border-indigo-500 ring-4 ring-indigo-100'
                    : title.length >= 10
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  {actionData?.errors?.title ? (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {actionData.errors.title}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">Sentence case, engaging and descriptive</p>
                  )}
                </div>
                <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  titleLength > 70 ? 'bg-amber-100 text-amber-700' : 
                  titleLength >= 10 ? 'bg-emerald-100 text-emerald-700' : 
                  'bg-gray-100 text-gray-600'
                }`}>
                  {titleLength}/80
                </div>
              </div>
              
              {/* Live Slug Preview */}
              {title.length >= 3 && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">URL Preview</p>
                  <p className="text-sm font-mono text-gray-700 break-all">
                    {BRAND.url}/<span className="text-indigo-600">{categorySlug}</span>/<span className="text-emerald-600 font-semibold">{slug || "..."}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Category & Author Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category */}
              <div className="relative">
                <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="categoryId"
                    name="categoryId"
                    required
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className={`w-full px-4 py-3 border-2 rounded-xl appearance-none transition-all duration-200 outline-none cursor-pointer ${
                      actionData?.errors?.categoryId 
                        ? 'border-red-300 bg-red-50' 
                        : selectedCategory 
                        ? 'border-emerald-300 bg-emerald-50/30' 
                        : 'border-gray-200 hover:border-gray-300'
                    } focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100`}
                  >
                    <option value="">Select a category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {actionData?.errors?.categoryId && (
                  <p className="mt-1 text-sm text-red-600">{actionData.errors.categoryId}</p>
                )}
              </div>

              {/* Author */}
              <div className="relative">
                <label htmlFor="authorId" className="block text-sm font-medium text-gray-700 mb-2">
                  Author <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="authorId"
                    name="authorId"
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl appearance-none transition-all duration-200 outline-none cursor-pointer hover:border-gray-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  >
                    <option value="">Select an author...</option>
                    {authors.map((author) => (
                      <option key={author.id} value={author.id}>
                        {author.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {actionData?.errors?.authorId && (
                  <p className="mt-1 text-sm text-red-600">{actionData.errors.authorId}</p>
                )}
              </div>
            </div>

            {/* Target Keyword */}
            <div>
              <label htmlFor="targetKeyword" className="block text-sm font-medium text-gray-700 mb-2">
                Target Keyword
                <span className="ml-2 text-xs font-normal text-gray-400">(optional)</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <input
                  type="text"
                  id="targetKeyword"
                  name="targetKeyword"
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl transition-all duration-200 outline-none hover:border-gray-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  placeholder="e.g., study in the UK, Canada study permit requirements"
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Primary keyword phrase for SEO/AEO optimization
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Excerpt */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Article Excerpt</h2>
                <p className="text-xs text-gray-500">Brief summary for previews and quick answers</p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="relative">
              <textarea
                id="excerpt"
                name="excerpt"
                required
                minLength={50}
                maxLength={300}
                rows={4}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                onFocus={() => setFocusedField('excerpt')}
                onBlur={() => setFocusedField(null)}
                className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 outline-none resize-none ${
                  actionData?.errors?.excerpt 
                    ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                    : focusedField === 'excerpt'
                    ? 'border-indigo-500 ring-4 ring-indigo-100'
                    : excerpt.length >= 50
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                placeholder="Write a compelling 2-3 sentence summary that captures the article's value. This appears in search results and social shares..."
              />
              
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-4">
                  {actionData?.errors?.excerpt ? (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {actionData.errors.excerpt}
                    </p>
                  ) : (
                    <>
                      <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
                        excerptWords >= 50 && excerptWords <= 80 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : excerptWords > 80 
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10" />
                        </svg>
                        {excerptWords} words
                      </div>
                      <span className="text-xs text-gray-400">Target: 50-80 words</span>
                    </>
                  )}
                </div>
                <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  excerptLength > 250 ? 'bg-amber-100 text-amber-700' : 
                  excerptLength >= 50 ? 'bg-emerald-100 text-emerald-700' : 
                  'bg-gray-100 text-gray-600'
                }`}>
                  {excerptLength}/300
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Hero Image */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Hero Image</h2>
                  <p className="text-xs text-gray-500">Featured image for the article (1200×630px recommended)</p>
                </div>
              </div>
              
              {/* Image Dimensions Badge */}
              {imageDimensions && imageValid && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                  imageDimensions.width >= 1200 && imageDimensions.height >= 630
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-amber-50 border-amber-100 text-amber-700'
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  <span className="text-xs font-medium">{imageDimensions.width}×{imageDimensions.height}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-6">
            {/* Source Toggle */}
            <div className="flex items-center gap-2 mb-4 p-1 bg-gray-100 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => { setImageSource('url'); clearImage(); }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  imageSource === 'url'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  URL
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setImageSource('upload'); clearImage(); }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  imageSource === 'upload'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Input */}
              <div className="space-y-4">
                {imageSource === 'url' ? (
                  /* URL Input */
                  <div>
                    <label htmlFor="heroImage" className="block text-sm font-medium text-gray-700 mb-2">
                      Image URL
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </div>
                      <input
                        type="url"
                        id="heroImage"
                        name="heroImage"
                        value={heroImage}
                        onChange={(e) => setHeroImage(e.target.value)}
                        className={`w-full pl-11 pr-12 py-3 border-2 rounded-xl transition-all duration-200 outline-none ${
                          imageValid === false 
                            ? 'border-red-300 bg-red-50' 
                            : imageValid === true 
                            ? 'border-emerald-300 bg-emerald-50/30' 
                            : 'border-gray-200 hover:border-gray-300'
                        } focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100`}
                        placeholder="https://images.unsplash.com/..."
                      />
                      {heroImage && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          {imageLoading ? (
                            <svg className="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : imageValid ? (
                            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </div>
                      )}
                    </div>
                    {imageValid === false && (
                      <p className="mt-1 text-sm text-red-600">Unable to load image. Please check the URL.</p>
                    )}
                  </div>
                ) : (
                  /* File Upload */
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Image
                    </label>
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                        isDragging
                          ? 'border-indigo-500 bg-indigo-50'
                          : heroImage && imageValid
                          ? 'border-emerald-300 bg-emerald-50/30'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      {/* Hidden input to store the data URL for form submission */}
                      <input type="hidden" name="heroImage" value={heroImage} />
                      
                      {imageLoading ? (
                        <div className="flex flex-col items-center">
                          <svg className="w-10 h-10 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <p className="mt-2 text-sm text-gray-500">Processing image...</p>
                        </div>
                      ) : heroImage && imageValid ? (
                        <div className="flex flex-col items-center">
                          <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="mt-2 text-sm font-medium text-emerald-700">Image uploaded</p>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); clearImage(); }}
                            className="mt-2 text-xs text-red-600 hover:text-red-700 underline"
                          >
                            Remove and upload another
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <svg className={`w-10 h-10 ${isDragging ? 'text-indigo-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          <p className="mt-2 text-sm font-medium text-gray-700">
                            {isDragging ? 'Drop image here' : 'Drag & drop or click to upload'}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">PNG, JPG, WebP up to 10MB</p>
                          <p className="mt-1 text-xs text-gray-400">Recommended: 1200×630px</p>
                        </div>
                      )}
                    </div>
                    {imageValid === false && imageSource === 'upload' && (
                      <p className="mt-1 text-sm text-red-600">Invalid image file. Please try another.</p>
                    )}
                  </div>
                )}

                {/* Alt Text - Always visible */}
                <div>
                  <label htmlFor="heroImageAlt" className="block text-sm font-medium text-gray-700 mb-2">
                    Alt Text
                    <span className="ml-1 text-xs font-normal text-gray-400">(for accessibility & SEO)</span>
                  </label>
                  <input
                    type="text"
                    id="heroImageAlt"
                    name="heroImageAlt"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl transition-all duration-200 outline-none hover:border-gray-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    placeholder="Describe the image content, include target keyword"
                  />
                </div>

                {/* Dimension Warning */}
                {imageDimensions && imageValid && (imageDimensions.width < 1200 || imageDimensions.height < 630) && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-amber-800">Image may appear blurry</p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        Current: {imageDimensions.width}×{imageDimensions.height}px. 
                        Recommended: 1200×630px minimum for optimal display.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Preview */}
              <div className="flex items-center justify-center">
                {heroImage && imageValid ? (
                  <div className="relative w-full aspect-[1200/630] rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm group">
                    <img 
                      src={heroImage} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200" />
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                      <span className="px-2 py-1 bg-black/60 text-white text-xs rounded-md">
                        Preview
                      </span>
                      <button
                        type="button"
                        onClick={clearImage}
                        className="p-1.5 bg-red-500/90 hover:bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200"
                        title="Remove image"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className={`w-full aspect-[1200/630] rounded-xl border-2 border-dashed bg-gray-50 flex flex-col items-center justify-center transition-all duration-200 ${
                      isDragging && imageSource === 'upload' ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'
                    }`}
                    onDragOver={imageSource === 'upload' ? handleDragOver : undefined}
                    onDragLeave={imageSource === 'upload' ? handleDragLeave : undefined}
                    onDrop={imageSource === 'upload' ? handleDrop : undefined}
                  >
                    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-400">Image preview</p>
                    <p className="text-xs text-gray-300">
                      {imageSource === 'url' ? 'Enter a valid URL' : 'Upload an image'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Section 3.5: Content Images */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Content Images</h2>
                  <p className="text-xs text-gray-500">Add images to use within your article content</p>
                </div>
              </div>
              
              {contentImages.length > 0 && (
                <span className="px-2.5 py-1 bg-cyan-50 text-cyan-700 text-xs font-medium rounded-full border border-cyan-100">
                  {contentImages.length} image{contentImages.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          
          <div className="p-6">
            {/* Add Image Form */}
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
              {/* Source Toggle */}
              <div className="flex items-center gap-2 mb-4 p-1 bg-white rounded-lg w-fit border border-gray-200">
                <button
                  type="button"
                  onClick={() => setContentImageSource('url')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                    contentImageSource === 'url'
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  URL
                </button>
                <button
                  type="button"
                  onClick={() => setContentImageSource('upload')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                    contentImageSource === 'upload'
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Upload
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {contentImageSource === 'url' ? (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Image URL</label>
                    <input
                      type="url"
                      value={contentImageUrl}
                      onChange={(e) => setContentImageUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                      placeholder="https://..."
                    />
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Upload Image</label>
                    <div
                      onClick={() => contentImageInputRef.current?.click()}
                      className="px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/50 transition-all duration-200 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Click to select image
                    </div>
                    <input
                      ref={contentImageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleContentImageUpload(file);
                      }}
                      className="hidden"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Alt Text</label>
                  <input
                    type="text"
                    value={contentImageAlt}
                    onChange={(e) => setContentImageAlt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                    placeholder="Describe the image"
                  />
                </div>
              </div>
              
              {contentImageSource === 'url' && (
                <button
                  type="button"
                  onClick={addContentImageFromUrl}
                  disabled={!contentImageUrl || contentImageLoading}
                  className="mt-4 px-4 py-2 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                >
                  {contentImageLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Image
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Image Gallery */}
            {contentImages.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {contentImages.map((image) => (
                  <div
                    key={image.id}
                    className="group relative bg-gray-100 rounded-xl overflow-hidden border border-gray-200 hover:border-cyan-300 transition-all duration-200"
                  >
                    <div className="aspect-square">
                      <img
                        src={image.url}
                        alt={image.alt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* Overlay with actions */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setInsertingImageId(insertingImageId === image.id ? null : image.id)}
                          className="p-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                          title="Insert into content"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => copyImageTag(image)}
                          className="p-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Copy HTML tag"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeContentImage(image.id)}
                          className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                          title="Remove image"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Alignment Selection Dropdown */}
                    {insertingImageId === image.id && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                        <div className="bg-white rounded-xl p-4 shadow-xl max-w-[90%]">
                          <p className="text-xs font-medium text-gray-700 mb-3 text-center">Choose alignment</p>
                          <div className="grid grid-cols-4 gap-2">
                            <button
                              type="button"
                              onClick={() => insertImageIntoContent(image, 'left')}
                              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-cyan-50 border border-gray-200 hover:border-cyan-300 transition-all"
                              title="Float left"
                            >
                              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h4m-4 4h4m-4 4h4m-4 4h4m4-12h8m-8 4h8m-8 4h8m-8 4h8" />
                              </svg>
                              <span className="text-[10px] text-gray-500">Left</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => insertImageIntoContent(image, 'center')}
                              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-cyan-50 border border-gray-200 hover:border-cyan-300 transition-all"
                              title="Center"
                            >
                              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M6 10h12M4 14h16M6 18h12" />
                              </svg>
                              <span className="text-[10px] text-gray-500">Center</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => insertImageIntoContent(image, 'right')}
                              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-cyan-50 border border-gray-200 hover:border-cyan-300 transition-all"
                              title="Float right"
                            >
                              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 6h4m-4 4h4m-4 4h4m-4 4h4m-12-12h8m-8 4h8m-8 4h8m-8 4h8" />
                              </svg>
                              <span className="text-[10px] text-gray-500">Right</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => insertImageIntoContent(image, 'full')}
                              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-cyan-50 border border-gray-200 hover:border-cyan-300 transition-all"
                              title="Full width"
                            >
                              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                              </svg>
                              <span className="text-[10px] text-gray-500">Full</span>
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setInsertingImageId(null)}
                            className="mt-3 w-full text-xs text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Image info */}
                    <div className="p-2 bg-white border-t border-gray-100">
                      <p className="text-xs text-gray-600 truncate" title={image.alt}>{image.alt}</p>
                      {image.dimensions && (
                        <p className="text-xs text-gray-400">{image.dimensions.width}×{image.dimensions.height}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-500">No content images added yet</p>
                <p className="text-xs text-gray-400 mt-1">Add images above to insert them into your article</p>
              </div>
            )}

            {/* Tip */}
            {contentImages.length > 0 && (
              <div className="mt-4 p-3 bg-cyan-50 rounded-lg border border-cyan-100 flex items-start gap-2">
                <svg className="w-4 h-4 text-cyan-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-cyan-700">
                  <strong>Tip:</strong> Click the edit icon to choose image alignment (left, center, right, full-width) before inserting into your content.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Section 4: Content */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Article Content</h2>
                  <p className="text-xs text-gray-500">HTML content with semantic headings</p>
                </div>
              </div>
              
              {/* Reading Time Badge & Preview Button */}
              <div className="flex items-center gap-3">
                {content.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-emerald-700">~{estimatedReadTime} min read</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  disabled={!title || !content}
                  className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span className="text-sm font-medium">Preview</span>
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {/* Interactive HTML Toolbar */}
            <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-700 mr-1">Insert:</span>
                {Object.entries(htmlSnippets).map(([key, { label, description }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => insertSnippet(key as keyof typeof htmlSnippets)}
                    className="group relative px-2 py-1 bg-white rounded-md border border-gray-200 text-xs font-mono text-gray-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-150 cursor-pointer"
                    title={description}
                  >
                    {label}
                    {/* Tooltip */}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none">
                      {description}
                      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-400">Click any tag to insert it at your cursor position</p>
            </div>

            <div className="relative">
              <textarea
                ref={contentRef}
                id="content"
                name="content"
                required
                minLength={100}
                rows={20}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onFocus={() => setFocusedField('content')}
                onBlur={() => setFocusedField(null)}
                className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 outline-none font-mono text-sm leading-relaxed resize-none ${
                  actionData?.errors?.content 
                    ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                    : focusedField === 'content'
                    ? 'border-indigo-500 ring-4 ring-indigo-100'
                    : content.length >= 100
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                placeholder={`<p>Start with a compelling introduction that hooks the reader...</p>

<h2>First Section Heading</h2>
<p>Explain your first main point with supporting details.</p>

<h2>Second Section Heading</h2>
<p>Continue with your next point...</p>

<blockquote>
  <p>Include a key insight or quote here.</p>
</blockquote>

<h2>Conclusion</h2>
<p>Summarize key takeaways and include a call to action.</p>`}
              />
              
              <div className="flex items-center justify-between mt-3">
                <div>
                  {actionData?.errors?.content ? (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {actionData.errors.content}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">Use H2 for main sections, H3 for subsections</p>
                  )}
                </div>
                <div className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  contentLength >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {contentLength.toLocaleString()} characters
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-between py-4">
          <a
            href="/admin/articles"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Cancel
          </a>
          
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-400 hidden sm:block">
              Article will be saved as draft
            </p>
            <button
              type="submit"
              disabled={isSubmitting || progress < 100}
              className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
                progress === 100
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-700 hover:to-emerald-600 shadow-lg shadow-emerald-200'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              } disabled:opacity-50`}
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
                  Create Draft
                </>
              )}
            </button>
          </div>
        </div>
      </Form>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowPreview(false)}
          />
          
          {/* Modal */}
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Article Preview</h3>
                    <p className="text-xs text-gray-500">How your article will appear when published</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="flex-1 overflow-y-auto">
                {/* Article Header Preview */}
                <div className="bg-gray-50 border-b border-gray-100">
                  <div className="max-w-3xl mx-auto px-6 py-8">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                      <span className="text-emerald-600">Home</span>
                      <span>/</span>
                      <span className="text-emerald-600">
                        {categories.find(c => c.id === selectedCategory)?.name || 'Category'}
                      </span>
                      <span>/</span>
                      <span className="text-gray-700 truncate max-w-[200px]">{title || 'Article Title'}</span>
                    </nav>

                    {/* Category & Meta */}
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full">
                        {categories.find(c => c.id === selectedCategory)?.name || 'Category'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                      {title || 'Your Article Title Will Appear Here'}
                    </h1>

                    {/* Excerpt */}
                    {excerpt && (
                      <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                        {excerpt}
                      </p>
                    )}

                    {/* Meta */}
                    <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                      <span>{estimatedReadTime} min read</span>
                      <span className="text-gray-300">·</span>
                      <span>By {BRAND.name} Research Team</span>
                    </div>
                  </div>
                </div>

                {/* Hero Image Preview */}
                {heroImage && imageValid && (
                  <div className="max-w-4xl mx-auto px-6 py-6">
                    <img 
                      src={heroImage} 
                      alt="Hero" 
                      className="w-full rounded-xl shadow-lg object-cover max-h-[400px]"
                    />
                  </div>
                )}

                {/* Article Content Preview */}
                <div className="max-w-3xl mx-auto px-6 py-8">
                  {content ? (
                    <div 
                      className="prose prose-lg prose-emerald max-w-none
                        prose-headings:font-bold prose-headings:text-gray-900
                        prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
                        prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
                        prose-p:text-gray-600 prose-p:leading-relaxed
                        prose-a:text-emerald-600 prose-a:no-underline hover:prose-a:underline
                        prose-strong:text-gray-900 prose-strong:font-semibold
                        prose-blockquote:border-l-4 prose-blockquote:border-emerald-500 prose-blockquote:bg-emerald-50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                        prose-ul:list-disc prose-ul:pl-6
                        prose-li:text-gray-600
                        prose-img:rounded-xl prose-img:shadow-md
                        prose-figure:my-6
                        prose-figcaption:text-center prose-figcaption:text-sm prose-figcaption:text-gray-500 prose-figcaption:mt-2"
                      dangerouslySetInnerHTML={{ __html: content }}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-400">Start writing content to see the preview</p>
                    </div>
                  )}
                </div>

                {/* Article Footer Preview */}
                {content && (
                  <div className="max-w-3xl mx-auto px-6 pb-8">
                    <div className="pt-6 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          Share this article
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                            </svg>
                          </span>
                          <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                            </svg>
                          </span>
                          <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  This is a preview. Some styles may differ slightly in the published version.
                </p>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
