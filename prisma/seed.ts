/**
 * Crest Study Consult Database Seed Script
 *
 * Populates initial data:
 * - 5 fixed education categories
 * - Default author (Crest Study Consult Research Team)
 * - Sample tags and articles for development
 * - Admin user
 *
 * Run: npx prisma db seed
 */

import { PrismaClient, PostStatus, SchemaType, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Crest Study Consult blog database...\n");

  // ============================================
  // Create Categories (fixed education set)
  // ============================================
  console.log("📁 Creating categories...");

  const categories = [
    {
      slug: "study-destinations",
      name: "Study Destinations",
      description:
        "Country and university guides for studying abroad in the UK, US, Canada, Australia, Germany, and Ireland. Compare institutions, costs, and student life from Crest Study Consult research.",
      metaTitle: "Study Destinations — Crest Study Consult",
      metaDesc:
        "Country and university guides for international students — the UK, US, Canada, Australia, Germany, and Ireland. Crest Study Consult study-abroad research.",
    },
    {
      slug: "admissions",
      name: "Admissions",
      description:
        "Admission requirements, application steps, and entry pathways for international students. Transcripts, English tests, personal statements, references, and deadlines explained.",
      metaTitle: "Admissions — Crest Study Consult",
      metaDesc:
        "Admission requirements and application guidance for international students. Step-by-step processes and checklists from Crest Study Consult.",
    },
    {
      slug: "visa-immigration",
      name: "Visa & Immigration",
      description:
        "Student visa processes, documentation, and immigration guidance for each study destination. Proof of funds, interviews, biometrics, and post-study work routes explained.",
      metaTitle: "Visa & Immigration — Crest Study Consult",
      metaDesc:
        "Student visa and immigration guidance for international students. Documentation, processing, and post-study work routes from Crest Study Consult.",
    },
    {
      slug: "scholarships",
      name: "Scholarships",
      description:
        "Scholarships, bursaries, and funding options for students studying abroad. Eligibility, application strategy, and deadlines for government, university, and external awards.",
      metaTitle: "Scholarships — Crest Study Consult",
      metaDesc:
        "Scholarships and funding for international students. Eligibility, deadlines, and application strategy from Crest Study Consult research.",
    },
    {
      slug: "study-intelligence",
      name: "Study Intelligence",
      description:
        "Data-driven intelligence on study destinations: visa difficulty, tuition ranges, living costs, work rights, and scholarship availability across major destinations.",
      metaTitle: "Study Intelligence — Crest Study Consult",
      metaDesc:
        "Data-driven study-abroad intelligence: visa difficulty, tuition, living costs, and work rights by destination. Crest Study Consult research.",
    },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
    console.log(`  ✓ ${category.name}`);
  }

  // ============================================
  // Create Default Author
  // ============================================
  console.log("\n👤 Creating default author...");

  const author = await prisma.author.upsert({
    where: { slug: "crest-study-consult-research-team" },
    update: {},
    create: {
      slug: "crest-study-consult-research-team",
      name: "Crest Study Consult Research Team",
      bio: "International education intelligence for students studying abroad. All guidance independently researched and verified against official sources.",
    },
  });
  console.log(`  ✓ ${author.name}`);

  // ============================================
  // Create Sample Tags
  // ============================================
  console.log("\n🏷️ Creating tags...");

  const tags = [
    { slug: "united-kingdom", name: "United Kingdom" },
    { slug: "united-states", name: "United States" },
    { slug: "canada", name: "Canada" },
    { slug: "australia", name: "Australia" },
    { slug: "germany", name: "Germany" },
    { slug: "ireland", name: "Ireland" },
    { slug: "student-visa", name: "Student Visa" },
    { slug: "scholarships", name: "Scholarships" },
    { slug: "admissions", name: "Admissions" },
    { slug: "study-abroad", name: "Study Abroad" },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: tag,
      create: tag,
    });
    console.log(`  ✓ ${tag.name}`);
  }

  // ============================================
  // Sample Article — Study in the UK (Study Destinations)
  // ============================================
  console.log("\n📝 Creating sample article (UK guide)...");

  const destinationsCategory = await prisma.category.findUnique({
    where: { slug: "study-destinations" },
  });

  if (destinationsCategory) {
    const ukArticle = await prisma.post.upsert({
      where: { slug: "study-in-the-uk-guide" },
      update: {},
      create: {
        slug: "study-in-the-uk-guide",
        title: "How to study in the UK: a complete guide for international students",
        metaTitle: "How to Study in the UK — Crest Study Consult",
        metaDescription:
          "Plan your UK studies with confidence: choose a course, meet entry requirements, apply for a Student visa, and budget for tuition. Crest Study Consult guide.",
        targetKeyword: "study in the UK",
        excerpt:
          "Studying in the UK involves choosing an accredited course, meeting entry and English-language requirements, securing a Confirmation of Acceptance for Studies (CAS), and applying for a Student visa. This guide walks international students through each step from research to arrival.",
        content: `<p>The United Kingdom hosts hundreds of thousands of international students each year across its universities and colleges. Studying there involves a clear sequence: choosing a course, meeting entry requirements, securing an offer, and applying for a Student visa.</p>

<h2 id="choose-a-course">How do you choose the right UK course and university?</h2>
<p>Start by matching your academic background and career goals to accredited programmes. Compare entry requirements, tuition, location, and graduate outcomes. Confirm that the university is a licensed student sponsor before you apply, as this is required for visa sponsorship.</p>

<h2 id="entry-requirements">What are the entry requirements for UK universities?</h2>
<p>Requirements vary by course and level, but most institutions ask for:</p>
<ul>
<li>Academic transcripts and certificates</li>
<li>Proof of English proficiency (commonly IELTS, though accepted tests vary)</li>
<li>A personal statement</li>
<li>Academic or professional references</li>
</ul>

<h2 id="apply">How do you apply to UK universities?</h2>
<p>Undergraduate applications are usually made through UCAS, while many postgraduate applications are made directly to the university. After you accept an offer, the university issues a Confirmation of Acceptance for Studies (CAS), which you need for your visa application.</p>

<h2 id="visa">What visa do international students need for the UK?</h2>
<p>Most international students apply for the UK Student visa. You generally need a CAS from a licensed sponsor, proof of funds for tuition and living costs, and proof of English proficiency. Processing times and fees vary, so confirm the current requirements on the official UK government website before applying.</p>

<h2 id="budget">How much does it cost to study in the UK?</h2>
<p>Costs depend on the course, level, and city. Budget for tuition, living expenses, the visa fee, and the Immigration Health Surcharge. Confirm current figures with each university and the UK government, as these change regularly.</p>`,
        categoryId: destinationsCategory.id,
        authorId: author.id,
        tags: {
          connect: [
            { slug: "united-kingdom" },
            { slug: "student-visa" },
            { slug: "study-abroad" },
          ],
        },
        status: PostStatus.LIVE,
        isPublished: true,
        isFeatured: true,
        readingTimeMin: 8,
        heroImage:
          "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&h=630&fit=crop",
        heroImageAlt: "International students on a UK university campus",
        canonicalURL:
          "https://blog.creststudyconsult.com/study-destinations/study-in-the-uk-guide",
        schemaType: SchemaType.ARTICLE,
        faqBlock: [
          {
            question: "Can international students work while studying in the UK?",
            answer:
              "Most students on a UK Student visa can work a limited number of hours during term time and full time during holidays, subject to conditions stated on their visa. Always confirm the current work limits on your visa and the official UK government guidance before taking a job.",
          },
          {
            question: "Do I need IELTS to study in the UK?",
            answer:
              "Many UK universities require evidence of English proficiency, and IELTS is widely accepted. However, accepted tests and minimum scores vary by institution and course. Check each university's specific English-language requirements before applying.",
          },
          {
            question: "Is there post-study work available in the UK?",
            answer:
              "The UK Graduate Route allows eligible students who complete a degree to stay and work, or look for work, for a defined period after graduating. Eligibility and duration depend on your level of study, so confirm current rules with the UK government before relying on this route.",
          },
        ],
        ctaBlock: {
          headline: "Plan your UK study journey",
          ctaText: "Book a consultation with Crest Study Consult",
          ctaLink: "https://creststudyconsult.com",
        },
        sourceNotes:
          "UK government student visa guidance (GOV.UK) and UCAS application guidance, accessed 2026. Confirm current figures before relying on them.",
      },
    });
    console.log(`  ✓ ${ukArticle.title}`);
  }

  // ============================================
  // Sample Article — Canada study permit (Visa & Immigration)
  // ============================================
  console.log("\n📝 Creating sample article (Canada study permit)...");

  const visaCategory = await prisma.category.findUnique({
    where: { slug: "visa-immigration" },
  });

  if (visaCategory) {
    const canadaArticle = await prisma.post.upsert({
      where: { slug: "canada-study-permit-requirements" },
      update: {},
      create: {
        slug: "canada-study-permit-requirements",
        title: "Canada study permit: requirements and application steps",
        metaTitle: "Canada Study Permit Requirements — Crest Study Consult",
        metaDescription:
          "Apply for a Canadian study permit with confidence: letter of acceptance, proof of funds, biometrics, and processing. Crest Study Consult visa guide.",
        targetKeyword: "Canada study permit requirements",
        excerpt:
          "A Canadian study permit generally requires a letter of acceptance from a designated learning institution, proof of funds for tuition and living costs, and supporting identity documents. This guide explains the core requirements and the application sequence for international students.",
        content: `<p>International students who want to study in Canada usually need a study permit. The process is document-driven, so preparing the right paperwork early reduces delays.</p>

<h2 id="acceptance">What is a designated learning institution?</h2>
<p>A study permit application generally starts with a letter of acceptance from a designated learning institution (DLI) — a school approved by a Canadian province or territory to host international students. Confirm a school's DLI status before you apply.</p>

<h2 id="requirements">What do you need for a Canadian study permit?</h2>
<p>Core requirements typically include:</p>
<ul>
<li>A letter of acceptance from a DLI</li>
<li>Proof of funds for tuition and living costs</li>
<li>A valid passport or travel document</li>
<li>Supporting documents that may vary by country and program</li>
</ul>

<h2 id="biometrics">Do you need biometrics?</h2>
<p>Most applicants are required to give biometrics (fingerprints and a photo) as part of the application. Plan for a biometrics appointment after you submit your application and pay the fee.</p>

<h2 id="processing">How long does processing take?</h2>
<p>Processing times vary by country and season. Apply early and confirm current timelines and fees on the official Immigration, Refugees and Citizenship Canada (IRCC) website before submitting.</p>`,
        categoryId: visaCategory.id,
        authorId: author.id,
        tags: {
          connect: [
            { slug: "canada" },
            { slug: "student-visa" },
            { slug: "study-abroad" },
          ],
        },
        status: PostStatus.LIVE,
        isPublished: true,
        isFeatured: true,
        readingTimeMin: 7,
        heroImage:
          "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=1200&h=630&fit=crop",
        heroImageAlt: "Student preparing study permit documents for Canada",
        canonicalURL:
          "https://blog.creststudyconsult.com/visa-immigration/canada-study-permit-requirements",
        schemaType: SchemaType.ARTICLE,
        faqBlock: [
          {
            question: "How much proof of funds do I need for a Canada study permit?",
            answer:
              "You must show enough money to cover tuition and living expenses for yourself and any accompanying family members. The minimum living-cost amount is set by IRCC and is updated periodically, so confirm the current figure on the official IRCC website before applying.",
          },
          {
            question: "Can I work on a Canadian study permit?",
            answer:
              "Eligible students may be able to work on or off campus subject to conditions on their permit. Work rules and hour limits are set by IRCC and can change, so verify your specific conditions and the current policy before accepting employment.",
          },
          {
            question: "Can I stay in Canada after graduating?",
            answer:
              "The Post-Graduation Work Permit (PGWP) allows eligible graduates of designated programs to work in Canada for a defined period. Eligibility depends on your institution and program, so confirm current PGWP rules with IRCC before relying on this pathway.",
          },
        ],
        ctaBlock: {
          headline: "Get help with your study permit",
          ctaText: "Book a consultation with Crest Study Consult",
          ctaLink: "https://creststudyconsult.com",
        },
        sourceNotes:
          "Immigration, Refugees and Citizenship Canada (IRCC) study permit guidance, accessed 2026. Confirm current figures and timelines before relying on them.",
      },
    });
    console.log(`  ✓ ${canadaArticle.title}`);
  }

  // ============================================
  // Sample Article — Scholarships (Scholarships)
  // ============================================
  console.log("\n📝 Creating sample article (scholarships)...");

  const scholarshipsCategory = await prisma.category.findUnique({
    where: { slug: "scholarships" },
  });

  if (scholarshipsCategory) {
    const scholarshipArticle = await prisma.post.upsert({
      where: { slug: "scholarships-for-international-students" },
      update: {},
      create: {
        slug: "scholarships-for-international-students",
        title: "Scholarships for international students: types and how to apply",
        metaTitle: "Scholarships for International Students — Crest Study Consult",
        metaDescription:
          "Understand scholarship types, eligibility, and application strategy for studying abroad. Government, university, and external funding explained by Crest Study Consult.",
        targetKeyword: "scholarships for international students",
        excerpt:
          "Scholarships for international students range from full awards covering tuition and living costs to partial tuition waivers. Funding comes from governments, universities, and external organisations, and eligibility usually depends on academic merit, course, and destination.",
        content: `<p>Scholarships reduce the cost of studying abroad and are offered by a range of providers. Understanding the main types helps you target applications where you are most competitive.</p>

<h2 id="types">What types of scholarships are available?</h2>
<ul>
<li><strong>Government scholarships</strong> — funded by national governments to attract international students</li>
<li><strong>University scholarships</strong> — offered by institutions, often based on merit or need</li>
<li><strong>External scholarships</strong> — provided by foundations, employers, and non-profit organisations</li>
</ul>

<h2 id="eligibility">Who is eligible for scholarships?</h2>
<p>Eligibility varies, but providers commonly assess academic merit, chosen course, country of origin, and financial need. Read each scholarship's criteria carefully, as requirements differ widely between programmes.</p>

<h2 id="apply">How do you apply for scholarships?</h2>
<p>Strong applications usually require academic records, a personal statement or essay, references, and proof of admission or intent to study. Track deadlines closely — many scholarships close months before the academic year begins.</p>

<h2 id="strategy">How do you improve your chances?</h2>
<p>Apply to several scholarships that match your profile, tailor each application to the provider's goals, and submit complete documentation before the deadline. Verify every detail with the official scholarship provider before applying.</p>`,
        categoryId: scholarshipsCategory.id,
        authorId: author.id,
        tags: {
          connect: [{ slug: "scholarships" }, { slug: "study-abroad" }],
        },
        status: PostStatus.LIVE,
        isPublished: true,
        isFeatured: false,
        readingTimeMin: 6,
        heroImage:
          "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&h=630&fit=crop",
        heroImageAlt: "Graduates at an international university commencement",
        canonicalURL:
          "https://blog.creststudyconsult.com/scholarships/scholarships-for-international-students",
        schemaType: SchemaType.FAQ_PAGE,
        faqBlock: [
          {
            question: "Are there fully funded scholarships for international students?",
            answer:
              "Yes. Some government and university scholarships cover tuition, living costs, and sometimes travel. These awards are highly competitive and have strict eligibility criteria and deadlines, so confirm the exact terms with each provider before applying.",
          },
          {
            question: "When should I apply for scholarships?",
            answer:
              "Apply as early as possible. Many scholarships close several months before the academic year begins, and some require you to hold an admission offer first. Build a timeline that maps each scholarship deadline against your university application dates.",
          },
          {
            question: "Can I hold more than one scholarship at a time?",
            answer:
              "Some providers allow you to combine awards, while others restrict it. Always check whether a scholarship can be held alongside other funding, as accepting one award may affect your eligibility for another.",
          },
        ],
        ctaBlock: {
          headline: "Find scholarships that fit your profile",
          ctaText: "Book a consultation with Crest Study Consult",
          ctaLink: "https://creststudyconsult.com",
        },
        sourceNotes:
          "Crest Study Consult scholarship research, 2026. Always confirm eligibility and deadlines with the official scholarship provider.",
      },
    });
    console.log(`  ✓ ${scholarshipArticle.title}`);
  }

  // ============================================
  // Sample Report — Destination comparison (Study Intelligence)
  // ============================================
  console.log("\n📝 Creating sample report (destination comparison)...");

  const intelligenceCategory = await prisma.category.findUnique({
    where: { slug: "study-intelligence" },
  });

  if (intelligenceCategory) {
    const report = await prisma.post.upsert({
      where: { slug: "study-destination-comparison-2026" },
      update: {},
      create: {
        slug: "study-destination-comparison-2026",
        title: "Study destination comparison: UK, Canada, and Germany",
        metaTitle: "Study Destination Comparison — Crest Study Consult",
        metaDescription:
          "Compare the UK, Canada, and Germany on tuition, visa routes, work rights, and post-study options for international students. Crest Study Consult study intelligence.",
        targetKeyword: "study destination comparison",
        excerpt:
          "Choosing a study destination means weighing tuition, visa requirements, work rights, and post-study options. This report compares the UK, Canada, and Germany across these factors to help international students shortlist destinations that fit their goals and budget.",
        content: `<p>International students often shortlist destinations before choosing a course. This report compares three popular destinations — the UK, Canada, and Germany — across the factors that most affect cost and outcomes. Figures change frequently, so treat them as indicative and confirm current details with official sources.</p>

<h2 id="tuition">How do tuition costs compare?</h2>
<p>Tuition varies widely by country, institution, and programme. UK and Canadian tuition for international students is typically charged per programme, while many public universities in Germany charge little or no tuition for certain programmes, with students still budgeting for living costs and administrative fees.</p>

<h2 id="visa">How do student visa routes compare?</h2>
<p>Each destination has its own student visa or permit: the UK Student visa, the Canadian study permit, and the German student visa. All require proof of admission and sufficient funds, with documentation and processing differing by country. Confirm current requirements with each government before applying.</p>

<h2 id="work-rights">What work rights do students have?</h2>
<p>Each destination allows eligible students to work a limited number of hours during study, subject to conditions. Limits and rules differ and change periodically, so verify the current policy for your destination and visa type.</p>

<h2 id="post-study">What post-study options exist?</h2>
<p>Post-study work routes exist in all three destinations, including the UK Graduate Route, Canada's Post-Graduation Work Permit, and Germany's post-study residence options for job-seeking. Eligibility depends on your level of study and institution, so confirm the current rules before relying on any route.</p>

<h2 id="methodology">Research methodology</h2>
<p>This comparison summarises publicly available guidance from official government and university sources. It is intended as an indicative overview, not financial or immigration advice. Always confirm current figures, eligibility, and rules with official sources before making decisions.</p>`,
        categoryId: intelligenceCategory.id,
        authorId: author.id,
        tags: {
          connect: [
            { slug: "united-kingdom" },
            { slug: "canada" },
            { slug: "germany" },
            { slug: "study-abroad" },
          ],
        },
        status: PostStatus.LIVE,
        isPublished: true,
        isFeatured: false,
        readingTimeMin: 12,
        heroImage:
          "https://images.unsplash.com/photo-1562774053-701939374585?w=1200&h=630&fit=crop",
        heroImageAlt: "University library representing study destination research",
        canonicalURL:
          "https://blog.creststudyconsult.com/study-intelligence/study-destination-comparison-2026",
        schemaType: SchemaType.REPORT,
        faqBlock: [
          {
            question: "Which country is cheapest for international students?",
            answer:
              "Cost depends on tuition and living expenses combined. Some public universities in Germany charge little or no tuition for certain programmes, which can lower total cost, though students still budget for living costs. Compare total cost, not tuition alone, and confirm figures with each institution.",
          },
          {
            question: "Which destination has the easiest student visa?",
            answer:
              "There is no single easiest visa, as requirements and approval depend on your documents, funds, and circumstances. Each destination has clear published requirements. Prepare complete, accurate documentation and confirm current rules with the relevant government before applying.",
          },
          {
            question: "Can I work after graduating in these countries?",
            answer:
              "All three destinations offer post-study work routes for eligible graduates, including the UK Graduate Route, Canada's PGWP, and Germany's post-study residence options. Eligibility and duration vary, so confirm the current rules for your situation with official sources.",
          },
        ],
        ctaBlock: {
          headline: "Shortlist the right destination",
          ctaText: "Book a consultation with Crest Study Consult",
          ctaLink: "https://creststudyconsult.com",
        },
        sourceNotes:
          "Crest Study Consult study intelligence, 2026, summarising official government and university guidance. Indicative only — confirm current figures and rules with official sources.",
        researchNotes:
          "Indicative comparison for development seed data. Replace with sourced figures before publishing live.",
      },
    });
    console.log(`  ✓ ${report.title}`);
  }

  // ============================================
  // Create Admin User
  // ============================================
  console.log("\n🔐 Creating admin user...");

  const bcrypt = await import("bcryptjs");
  const adminEmail = process.env.ADMIN_EMAIL || "admin@creststudyconsult.com";
  // Default password for development only — change immediately in production.
  const defaultPassword = process.env.ADMIN_PASSWORD || "CrestAdmin2026!";
  const hashedPassword = await bcrypt.hash(defaultPassword, 12);

  const adminUser = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { role: UserRole.SYSTEMS_ADMIN, isActive: true },
    create: {
      email: adminEmail,
      passwordHash: hashedPassword,
      name: "Crest Study Consult Admin",
      role: UserRole.SYSTEMS_ADMIN,
    },
  });
  console.log(`  ✓ ${adminUser.email}`);
  console.log(`    Password: ${defaultPassword}`);
  console.log("    ⚠️  Change this password immediately in production!");

  console.log("\n✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
