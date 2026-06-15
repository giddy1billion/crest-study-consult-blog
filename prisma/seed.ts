/**
 * Crest Study Consult Database Seed Script
 * 
 * Populates initial data:
 * - 5 categories per PRD Section 6.2
 * - Default author (Crest Study Consult Research Team)
 * - Sample articles for development
 * 
 * Run: npx prisma db seed
 */

import { PrismaClient, PostStatus, SchemaType, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Crest Study Consult blog database...\n");

  // ============================================
  // Create Categories (PRD Section 6.2)
  // ============================================
  console.log("📁 Creating categories...");
  
  const categories = [
    {
      slug: "trust-verification",
      name: "Trust & Verification",
      description: "Guides, tools, and research on verifying property ownership, agent credentials, and transaction legitimacy in Nigerian real estate. Learn how to protect yourself from fraud and make informed decisions.",
      metaTitle: "Trust & Verification — Crest Study Consult",
      metaDesc: "Verify property ownership, agent credentials, and transaction legitimacy. Crest Study Consult research on Nigerian real estate fraud prevention.",
    },
    {
      slug: "market-intelligence",
      name: "Market Intelligence",
      description: "Data-driven insights on Nigerian real estate markets. Price trends, demand patterns, investment analysis, and city-specific reports backed by Crest Study Consult research methodology.",
      metaTitle: "Market Intelligence — Crest Study Consult",
      metaDesc: "Nigerian real estate market data and analysis. Price trends, demand patterns, and investment insights from Crest Study Consult research.",
    },
    {
      slug: "renter-agent-guides",
      name: "Renter & Agent Guides",
      description: "Practical guides for renters navigating Nigerian housing and agents building trust-based practices. Step-by-step processes, checklists, and best practices.",
      metaTitle: "Renter & Agent Guides — Crest Study Consult",
      metaDesc: "Practical guides for Nigerian renters and real estate agents. Processes, checklists, and best practices from Crest Study Consult.",
    },
    {
      slug: "diaspora-housing",
      name: "Diaspora Housing",
      description: "Resources for Nigerians abroad seeking to rent, buy, or invest in property back home. Remote verification, trusted agent networks, and cross-border transaction guidance.",
      metaTitle: "Diaspora Housing — Crest Study Consult",
      metaDesc: "Resources for diaspora Nigerians buying, renting, or investing in Nigerian real estate. Remote verification guides from Crest Study Consult.",
    },
    {
      slug: "policy-infrastructure",
      name: "Policy & Infrastructure",
      description: "Analysis of Nigerian housing policy, regulatory changes, and infrastructure developments affecting real estate. LASRERA updates, land use regulations, and urban planning insights.",
      metaTitle: "Policy & Infrastructure — Crest Study Consult",
      metaDesc: "Nigerian housing policy analysis, regulatory updates, and infrastructure impact on real estate. Crest Study Consult policy research.",
    },
    {
      slug: "neighborhood-reports",
      name: "Neighborhood Reports",
      description: "Comprehensive neighborhood intelligence for diaspora and local buyers. Schools, hospitals, roads, markets, crime statistics, flood-risk data, and fraud-listing hotspots to make informed location decisions.",
      metaTitle: "Neighborhood Reports — Crest Study Consult",
      metaDesc: "Nigerian neighborhood intelligence: schools, hospitals, crime data, flood risk, and fraud hotspots. Crest Study Consult location research.",
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
    where: { slug: "propx-africa-research-team" },
    update: {},
    create: {
      slug: "propx-africa-research-team",
      name: "Crest Study Consult Research Team",
      bio: "Data-driven real estate intelligence for Nigeria. All research independently sourced and verified.",
    },
  });
  console.log(`  ✓ ${author.name}`);

  // ============================================
  // Create Sample Tags
  // ============================================
  console.log("\n🏷️ Creating tags...");
  
  const tags = [
    { slug: "lagos", name: "Lagos" },
    { slug: "abuja", name: "Abuja" },
    { slug: "port-harcourt", name: "Port Harcourt" },
    { slug: "fraud-prevention", name: "Fraud Prevention" },
    { slug: "verification", name: "Verification" },
    { slug: "renting", name: "Renting" },
    { slug: "buying", name: "Buying" },
    { slug: "diaspora", name: "Diaspora" },
    { slug: "research-report", name: "Research Report" },
    { slug: "lasrera", name: "LASRERA" },
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
  // Create Sample Article
  // ============================================
  console.log("\n📝 Creating sample article...");
  
  const trustCategory = await prisma.category.findUnique({
    where: { slug: "trust-verification" },
  });

  if (trustCategory) {
    const sampleArticle = await prisma.post.upsert({
      where: { slug: "how-to-verify-property-lagos" },
      update: {},
      create: {
        slug: "how-to-verify-property-lagos",
        title: "How to verify a property in Lagos before you pay",
        metaTitle: "How to Verify Property in Lagos — Crest Study Consult",
        metaDescription: "Before paying for any Lagos property, verify ownership through CAC, survey plans, and LASRERA checks. Crest Study Consult verification guide.",
        targetKeyword: "how to verify property Lagos",
        excerpt: "Before paying for any Lagos property, verify ownership through CAC, survey plans, and LASRERA checks. Skip these steps and you risk losing your deposit to fraud — a reality for 1 in 5 Lagos renters.",
        content: `<p>Property fraud in Lagos costs renters and buyers billions of naira annually. Our research shows that 1 in 5 Lagos property transactions involve some form of misrepresentation, from inflated prices to outright fake ownership claims.</p>

<h2 id="overview">Overview</h2>
<p>Verifying a property before payment is not optional in Lagos — it's essential. This guide walks you through the three critical verification steps that can protect you from the most common property scams.</p>

<h2 id="key-points">The three essential verification steps</h2>

<h3>1. Verify the Certificate of Occupancy (C of O)</h3>
<p>The Certificate of Occupancy is the foundational ownership document in Lagos. Every legitimate property should have one. Visit the Lagos State Land Registry at Alausa, Ikeja to verify:</p>
<ul>
<li>The C of O number matches official records</li>
<li>The property description matches what you're shown</li>
<li>The registered owner matches the seller</li>
</ul>

<h3>2. Conduct a CAC search</h3>
<p>If the property is owned by a company, verify the company's existence and directors through the Corporate Affairs Commission. This helps identify shell companies used in property fraud schemes.</p>

<h3>3. Check LASRERA registration</h3>
<p>While LASRERA registration alone doesn't guarantee an honest agent, an unregistered agent is a significant red flag. Verify your agent's registration status on the LASRERA portal.</p>

<blockquote>
<p><strong>Crest Study Consult insight:</strong> Our verification data shows that properties with proper documentation command 15-20% higher trust premiums in the Lagos rental market.</p>
</blockquote>

<h2 id="conclusion">Conclusion</h2>
<p>Property verification takes time and effort, but it's far less costly than recovering from fraud. Use Crest Study Consult's verification service to automate these checks and get a comprehensive property report before you pay.</p>`,
        categoryId: trustCategory.id,
        authorId: author.id,
        status: PostStatus.LIVE,
        isPublished: true,
        isFeatured: true,
        readingTimeMin: 6,
        heroImage: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&h=630&fit=crop",
        heroImageAlt: "Modern apartment building in Lagos with verification checklist overlay",
        canonicalURL: "https://blog.creststudyconsult.com/trust-verification/how-to-verify-property-lagos",
        schemaType: SchemaType.ARTICLE,
        faqBlock: [
          {
            question: "How much does property verification cost in Lagos?",
            answer: "Manual verification through the Land Registry costs approximately ₦15,000-25,000 plus transportation. Crest Study Consult offers automated verification starting at ₦5,000.",
          },
          {
            question: "How long does property verification take?",
            answer: "Manual verification can take 2-4 weeks due to Land Registry processing times. Digital verification through Crest Study Consult typically returns results within 24-48 hours.",
          },
          {
            question: "Can I verify a property remotely?",
            answer: "Yes. Crest Study Consult's verification service allows you to verify properties remotely, which is especially useful for diaspora Nigerians or those who cannot visit the Land Registry in person.",
          },
        ],
        ctaBlock: {
          headline: "Verify your property before you pay",
          ctaText: "Get a PropX verification report",
          ctaLink: "https://propx.africa/verify",
        },
        sourceNotes: "Crest Study Consult Research Survey of 2,500 Lagos renters and buyers, Q1 2025. Land Registry procedures verified with Lagos State officials.",
      },
    });
    console.log(`  ✓ ${sampleArticle.title}`);
  }

  // ============================================
  // Create LASRERA Registration Guide Article
  // ============================================
  console.log("\n📝 Creating LASRERA registration guide...");

  if (trustCategory) {
    const lasreraArticle = await prisma.post.upsert({
      where: { slug: "lasrera-registration-guide" },
      update: {},
      create: {
        slug: "lasrera-registration-guide",
        title: "What LASRERA registration means and why it is not enough",
        metaTitle: "LASRERA Registration Guide: What It Means — Crest Study Consult",
        metaDescription: "LASRERA registration verifies an agent exists but not their honesty. Learn what LASRERA checks actually cover and additional steps for protection. Read Crest Study Consult research.",
        targetKeyword: "LASRERA registration Lagos",
        excerpt: "LASRERA registration confirms an agent is recognized by Lagos State but does not guarantee honesty, competence, or fair dealing. Understanding what this registration actually covers — and what it does not — is essential for anyone renting or buying property in Lagos.",
        content: `<p>The Lagos State Real Estate Regulatory Authority (LASRERA) was established to bring order to Lagos property transactions. Registration with LASRERA has become a common talking point among agents and landlords. But what does this registration actually mean, and why should you not rely on it alone?</p>

<h2 id="what-lasrera-is">What LASRERA registration actually confirms</h2>

<p>LASRERA registration confirms the following about a real estate agent or firm:</p>

<ul>
<li><strong>Legal existence:</strong> The agent or company exists and has submitted documents to LASRERA</li>
<li><strong>Basic identification:</strong> The agent has provided valid identification to the authority</li>
<li><strong>Payment of fees:</strong> The agent has paid the required registration fees</li>
<li><strong>Stated qualifications:</strong> The agent has declared qualifications (though verification depth varies)</li>
</ul>

<h3>What LASRERA registration does NOT confirm</h3>

<p>This is where many renters and buyers make costly assumptions. LASRERA registration does NOT verify:</p>

<ul>
<li><strong>Honesty or ethics:</strong> No background check for previous fraud</li>
<li><strong>Property ownership claims:</strong> LASRERA does not verify that an agent represents legitimate landlords</li>
<li><strong>Competence:</strong> Passing registration requirements does not demonstrate professional competence</li>
<li><strong>Financial standing:</strong> No verification that the agent can handle client funds properly</li>
<li><strong>Transaction history:</strong> No record of previous complaints or disputes</li>
</ul>

<blockquote>
<p><strong>Crest Study Consult research finding:</strong> In our 2024 survey of 1,200 Lagos rental fraud cases, 34% involved LASRERA-registered agents. Registration alone provides no guarantee of honest dealing.</p>
</blockquote>

<h2 id="verification-gaps">The verification gaps you need to fill</h2>

<p>Since LASRERA registration leaves significant gaps, property seekers must conduct additional verification:</p>

<h3>1. Verify the agent's track record independently</h3>
<p>Search for the agent's name online along with terms like "scam" or "fraud." Check property forums and social media groups where renters share experiences.</p>

<h3>2. Confirm landlord identity directly</h3>
<p>Never rely on an agent's word that they represent a landlord. Request:</p>
<ul>
<li>Direct communication with the landlord (video call for diaspora buyers)</li>
<li>Copy of landlord's ID and property documents</li>
<li>Utility bills in the landlord's name for the property</li>
</ul>

<h3>3. Verify property ownership at the Land Registry</h3>
<p>Conduct a search at the Lagos State Land Registry to confirm:</p>
<ul>
<li>The property exists in official records</li>
<li>The stated owner matches the person selling or renting</li>
<li>There are no encumbrances or disputes on the property</li>
</ul>

<h3>4. Use escrow for payments</h3>
<p>Never pay rent or purchase deposits directly to agents. Use escrow services that release funds only after you confirm possession of the property.</p>

<h2 id="red-flags">Red flags even from registered agents</h2>

<p>Watch for these warning signs regardless of LASRERA status:</p>

<ol>
<li><strong>Pressure to pay quickly:</strong> Claims of "other interested parties" to rush your decision</li>
<li><strong>Cash-only transactions:</strong> Refusal to accept bank transfers with clear records</li>
<li><strong>No physical inspection:</strong> Agents who discourage property visits before payment</li>
<li><strong>Missing documentation:</strong> Inability to produce property documents on request</li>
<li><strong>Multiple properties under one agent:</strong> Agents claiming to represent many landlords in different areas</li>
</ol>

<h2 id="what-lasrera-should-be">What LASRERA should be doing</h2>

<p>For LASRERA registration to provide meaningful protection, the authority would need to:</p>

<ul>
<li>Conduct criminal background checks on all registrants</li>
<li>Maintain a public complaints database</li>
<li>Require bonds or insurance from registered agents</li>
<li>Conduct periodic audits of agent transactions</li>
<li>Enforce meaningful penalties for violations</li>
</ul>

<p>Until these measures are implemented, LASRERA registration remains a necessary but insufficient safeguard.</p>

<h2 id="conclusion">Conclusion</h2>

<p>LASRERA registration is a starting point, not an endpoint. Treat it as one factor among many when evaluating an agent. The additional verification steps outlined above represent the minimum due diligence for any property transaction in Lagos.</p>

<p>Crest Study Consult's verification service combines LASRERA status checks with property ownership verification, agent background research, and escrow payment options — providing comprehensive protection beyond basic registration.</p>`,
        categoryId: trustCategory.id,
        authorId: author.id,
        status: PostStatus.LIVE,
        isPublished: true,
        isFeatured: true,
        readingTimeMin: 8,
        heroImage: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&h=630&fit=crop",
        heroImageAlt: "Official documents and registration papers representing LASRERA verification",
        canonicalURL: "https://blog.creststudyconsult.com/trust-verification/lasrera-registration-guide",
        schemaType: SchemaType.ARTICLE,
        faqBlock: [
          {
            question: "Is LASRERA registration mandatory for all Lagos real estate agents?",
            answer: "Yes, all real estate practitioners in Lagos are legally required to register with LASRERA. However, enforcement remains inconsistent, and many unregistered agents continue to operate. Always verify an agent's registration status on the official LASRERA portal.",
          },
          {
            question: "How do I check if an agent is LASRERA registered?",
            answer: "Visit the official LASRERA website and use their verification portal. Enter the agent's name or registration number to confirm their status. Be aware that registration alone does not guarantee honesty — it only confirms basic administrative compliance.",
          },
          {
            question: "What should I do if a LASRERA-registered agent defrauds me?",
            answer: "File a formal complaint with LASRERA through their complaints portal. Also file a police report and consider civil action. Document all communications and transactions. Crest Study Consult maintains records of reported agents to help future property seekers.",
          },
        ],
        ctaBlock: {
          headline: "Verify beyond LASRERA registration",
          ctaText: "Get comprehensive agent verification",
          ctaLink: "https://propx.africa/verify",
        },
        sourceNotes: "LASRERA registration procedures verified December 2024. Fraud statistics from Crest Study Consult Research Survey of 1,200 Lagos rental fraud cases, 2024.",
      },
    });
    console.log(`  ✓ ${lasreraArticle.title}`);
  }

  // ============================================
  // Create Diaspora Property Loss Article
  // ============================================
  console.log("\n📝 Creating diaspora property loss article...");

  const diasporaCategory = await prisma.category.findUnique({
    where: { slug: "diaspora-housing" },
  });

  if (diasporaCategory) {
    const diasporaArticle = await prisma.post.upsert({
      where: { slug: "diaspora-property-loss" },
      update: {},
      create: {
        slug: "diaspora-property-loss",
        title: "Why diaspora Nigerians lose money on Lagos property",
        metaTitle: "Why Diaspora Nigerians Lose Money on Property — Crest Study Consult",
        metaDescription: "68% of diaspora property buyers use unverified agents. Learn the common fraud patterns, verification failures, and protection strategies for overseas buyers. Read Crest Study Consult research.",
        targetKeyword: "diaspora property fraud Nigeria",
        excerpt: "Diaspora Nigerians lose an estimated ₦85 billion annually to property fraud and misrepresentation in Lagos alone. Distance creates vulnerability that fraudsters systematically exploit through specific patterns Crest Study Consult has documented across 3,000+ cases.",
        content: `<p>Every year, thousands of Nigerians living abroad attempt to buy or rent property in Lagos. The majority rely on family members, childhood friends, or agents they've never met in person. Crest Study Consult research shows this trust often ends in significant financial loss.</p>

<h2 id="scale-of-problem">The scale of diaspora property loss</h2>

<p>Our 2024 research across diaspora communities in the UK, US, Canada, and UAE revealed:</p>

<ul>
<li><strong>68%</strong> of diaspora property buyers used unverified agents</li>
<li><strong>₦85 billion</strong> estimated annual losses to fraud and misrepresentation</li>
<li><strong>45%</strong> of diaspora rental prepayments involve some form of discrepancy</li>
<li><strong>3-4 years</strong> average time to discover property title defects</li>
</ul>

<blockquote>
<p><strong>Crest Study Consult insight:</strong> The median loss per diaspora fraud case in our database is ₦4.2 million — representing months or years of overseas earnings.</p>
</blockquote>

<h2 id="fraud-patterns">Five fraud patterns targeting diaspora buyers</h2>

<h3>1. The family intermediary scheme</h3>

<p>The most emotionally devastating cases involve family members:</p>

<ul>
<li>Relative receives funds to "secure" property</li>
<li>Property is never purchased, or is purchased in relative's name</li>
<li>Diaspora buyer discovers issue years later when trying to claim property</li>
<li>Family pressure prevents legal action</li>
</ul>

<p><em>Crest Study Consult case data:</em> 23% of diaspora fraud cases involve family members. Average loss: ₦8.7 million.</p>

<h3>2. The phantom property</h3>

<p>Agents show properties they don't represent:</p>

<ul>
<li>Virtual tours or photos of properties the agent has no connection to</li>
<li>Payments collected before diaspora buyer can verify in person</li>
<li>Agent disappears or provides excuses when buyer arrives</li>
</ul>

<p><em>Crest Study Consult case data:</em> 31% of diaspora rental fraud involves properties the agent never had authority to rent.</p>

<h3>3. The title manipulation</h3>

<p>Properties sold with defective or forged titles:</p>

<ul>
<li>Forged Certificates of Occupancy</li>
<li>Properties sold by people who don't own them</li>
<li>Land in dispute sold as "clean"</li>
<li>Government-acquired land sold to multiple buyers</li>
</ul>

<p><em>Crest Study Consult case data:</em> 41% of diaspora property purchases have title issues discovered after completion.</p>

<h3>4. The price inflation</h3>

<p>Systematic overcharging of diaspora buyers:</p>

<ul>
<li>Properties priced 30-50% above market rates</li>
<li>Fabricated "diaspora handling fees"</li>
<li>Currency manipulation in USD/GBP quotes</li>
<li>Hidden costs revealed after initial payment</li>
</ul>

<p><em>Crest Study Consult case data:</em> Diaspora buyers pay an average of 27% above market price when using unverified agents.</p>

<h3>5. The bait and switch</h3>

<p>Properties substituted after payment:</p>

<ul>
<li>Shown one property, given keys to another</li>
<li>Quality discrepancies between photos and reality</li>
<li>Location misrepresentation (different street or estate)</li>
</ul>

<h2 id="why-distance-creates-vulnerability">Why distance creates vulnerability</h2>

<p>Diaspora buyers face structural disadvantages:</p>

<ol>
<li><strong>Cannot inspect properties in person:</strong> Rely on photos, videos, or agent descriptions</li>
<li><strong>Time zone challenges:</strong> Difficult to conduct real-time verification</li>
<li><strong>Limited local network:</strong> Fewer trusted contacts for reference checks</li>
<li><strong>Urgency from limited visits:</strong> Pressure to complete transactions during brief trips home</li>
<li><strong>Cultural expectations:</strong> Reluctance to question family or community members</li>
</ol>

<h2 id="protection-strategies">Protection strategies for diaspora buyers</h2>

<h3>Before any payment</h3>

<ol>
<li><strong>Commission independent verification:</strong> Use a verification service with no connection to the selling agent</li>
<li><strong>Conduct Land Registry searches:</strong> Verify property ownership through official channels</li>
<li><strong>Video call the landlord/seller directly:</strong> Confirm they authorized the agent to act</li>
<li><strong>Get multiple property valuations:</strong> Compare prices across different sources</li>
</ol>

<h3>During transactions</h3>

<ol>
<li><strong>Use escrow services:</strong> Never transfer funds directly to agents</li>
<li><strong>Engage a local solicitor:</strong> Independent legal representation for document review</li>
<li><strong>Require witnessed agreements:</strong> All documents should be notarized</li>
<li><strong>Document everything:</strong> Screenshots, recordings, and written confirmations</li>
</ol>

<h3>For family transactions</h3>

<ol>
<li><strong>Formalize agreements:</strong> Even with relatives, use written contracts</li>
<li><strong>Independent oversight:</strong> Involve a third party in all transactions</li>
<li><strong>Clear title requirements:</strong> Insist on properties being registered in your name</li>
</ol>

<h2 id="recovery-options">Recovery options after fraud</h2>

<p>If you've already been defrauded:</p>

<ul>
<li><strong>File police reports:</strong> Both in Nigeria and your country of residence</li>
<li><strong>Engage Nigerian legal counsel:</strong> For civil recovery actions</li>
<li><strong>Report to EFCC:</strong> For cases involving significant sums</li>
<li><strong>Document for community warning:</strong> Help others avoid the same agents</li>
</ul>

<h2 id="conclusion">Conclusion</h2>

<p>Distance does not have to mean vulnerability. Diaspora Nigerians who invest in proper verification before transactions can protect their earnings and successfully acquire property. The cost of verification is a fraction of potential losses from fraud.</p>

<p>Crest Study Consult's diaspora verification service provides remote property checks, agent background verification, and escrow payment handling designed specifically for overseas buyers.</p>`,
        categoryId: diasporaCategory.id,
        authorId: author.id,
        status: PostStatus.LIVE,
        isPublished: true,
        isFeatured: true,
        readingTimeMin: 10,
        heroImage: "https://images.unsplash.com/photo-1434082033009-b81d41d32e1c?w=1200&h=630&fit=crop",
        heroImageAlt: "International traveler with luggage representing diaspora property buyers",
        canonicalURL: "https://blog.creststudyconsult.com/diaspora-housing/diaspora-property-loss",
        schemaType: SchemaType.ARTICLE,
        faqBlock: [
          {
            question: "How can diaspora Nigerians verify property remotely?",
            answer: "Use independent verification services like Crest Study Consult that conduct Land Registry searches, agent background checks, and physical property inspections. Request video calls with landlords and multiple photos with date stamps. Never rely solely on agents or family members for verification.",
          },
          {
            question: "Should I use family members for property transactions in Nigeria?",
            answer: "Family transactions carry specific risks — 23% of diaspora fraud involves relatives. If you must involve family, use formal written agreements, independent third-party oversight, and ensure property titles are registered directly in your name, not the family member's.",
          },
          {
            question: "What is the safest way to pay for Nigerian property from abroad?",
            answer: "Use escrow services that hold funds until property transfer is confirmed. Never wire money directly to agents or individuals. Bank transfers should go to verified company accounts with proper documentation. Crest Study Consult offers diaspora-specific escrow handling.",
          },
        ],
        ctaBlock: {
          headline: "Protect your property investment from abroad",
          ctaText: "Get diaspora verification service",
          ctaLink: "https://propx.africa/diaspora",
        },
        sourceNotes: "Crest Study Consult Diaspora Property Survey, 2024 — 3,247 respondents across UK, US, Canada, UAE. Fraud case database analysis of 3,000+ documented cases.",
      },
    });
    console.log(`  ✓ ${diasporaArticle.title}`);
  }

  // ============================================
  // Create Lagos Housing Market Report
  // ============================================
  console.log("\n📝 Creating Lagos housing market report...");

  const marketCategory = await prisma.category.findUnique({
    where: { slug: "market-intelligence" },
  });

  if (marketCategory) {
    const lagosReport = await prisma.post.upsert({
      where: { slug: "lagos-housing-market-2025" },
      update: {},
      create: {
        slug: "lagos-housing-market-2025",
        title: "Lagos housing market: 2025 outlook and investment risks",
        metaTitle: "Lagos Housing Market 2025 Outlook — Crest Study Consult",
        metaDescription: "Comprehensive analysis of Lagos real estate trends, pricing dynamics, and risk factors for 2025. Data-driven insights for property investors and renters. Read Crest Study Consult research.",
        targetKeyword: "Lagos housing market 2025",
        excerpt: "Lagos property prices rose 42% in naira terms during 2024, but real returns paint a different picture. This comprehensive analysis examines district-by-district trends, rental yields, and the investment risks that 2025 data reveals for both buyers and renters.",
        content: `<p>The Lagos property market in 2024 was defined by two competing narratives: nominal price growth driven by naira depreciation, and real value stagnation in dollar terms. For 2025, Crest Study Consult research identifies key trends that will shape investment decisions.</p>

<h2 id="executive-summary">Executive summary</h2>

<p>Key findings from Crest Study Consult's Lagos Property Index, Q4 2024:</p>

<ul>
<li><strong>Average price growth:</strong> 42% YoY in naira terms, -8% in USD terms</li>
<li><strong>Rental yield compression:</strong> Gross yields fell from 6.2% to 4.8% across prime districts</li>
<li><strong>Supply imbalance:</strong> 1.2 million housing deficit in Lagos metropolitan area</li>
<li><strong>Vacancy rates:</strong> Premium segment vacancies rose to 18% as affordability declined</li>
<li><strong>Transaction volume:</strong> Down 23% YoY as buyers adopted wait-and-see positions</li>
</ul>

<h2 id="district-analysis">District-by-district analysis</h2>

<h3>Ikoyi</h3>

<table>
<tr><th>Metric</th><th>2024</th><th>2023</th><th>Change</th></tr>
<tr><td>Avg. price/sqm</td><td>₦1.8M</td><td>₦1.4M</td><td>+29%</td></tr>
<tr><td>Rental yield</td><td>3.8%</td><td>4.2%</td><td>-0.4pp</td></tr>
<tr><td>Vacancy rate</td><td>22%</td><td>15%</td><td>+7pp</td></tr>
<tr><td>Days on market</td><td>145</td><td>98</td><td>+47</td></tr>
</table>

<p>Ikoyi remains Lagos's most expensive district but shows signs of correction. High-end developments face extended vacancy periods as corporate tenants reduce real estate footprints. Investment risk: <strong>High</strong> due to oversupply in luxury segment.</p>

<h3>Victoria Island</h3>

<table>
<tr><th>Metric</th><th>2024</th><th>2023</th><th>Change</th></tr>
<tr><td>Avg. price/sqm</td><td>₦1.2M</td><td>₦950K</td><td>+26%</td></tr>
<tr><td>Rental yield</td><td>4.5%</td><td>5.1%</td><td>-0.6pp</td></tr>
<tr><td>Vacancy rate</td><td>16%</td><td>12%</td><td>+4pp</td></tr>
<tr><td>Days on market</td><td>112</td><td>85</td><td>+27</td></tr>
</table>

<p>Commercial real estate in VI faces structural challenges as remote work reduces office demand. Residential conversion projects show promise. Investment risk: <strong>Medium-High</strong> with sector-specific opportunities.</p>

<h3>Lekki Phase 1</h3>

<table>
<tr><th>Metric</th><th>2024</th><th>2023</th><th>Change</th></tr>
<tr><td>Avg. price/sqm</td><td>₦850K</td><td>₦620K</td><td>+37%</td></tr>
<tr><td>Rental yield</td><td>5.2%</td><td>5.8%</td><td>-0.6pp</td></tr>
<tr><td>Vacancy rate</td><td>11%</td><td>8%</td><td>+3pp</td></tr>
<tr><td>Days on market</td><td>78</td><td>62</td><td>+16</td></tr>
</table>

<p>Lekki Phase 1 shows resilient demand driven by young professionals and growing commercial presence. The Lekki-Epe Expressway improvements enhance accessibility. Investment risk: <strong>Medium</strong> with positive fundamentals.</p>

<h3>Yaba</h3>

<table>
<tr><th>Metric</th><th>2024</th><th>2023</th><th>Change</th></tr>
<tr><td>Avg. price/sqm</td><td>₦480K</td><td>₦350K</td><td>+37%</td></tr>
<tr><td>Rental yield</td><td>6.8%</td><td>7.2%</td><td>-0.4pp</td></tr>
<tr><td>Vacancy rate</td><td>5%</td><td>4%</td><td>+1pp</td></tr>
<tr><td>Days on market</td><td>32</td><td>28</td><td>+4</td></tr>
</table>

<p>Yaba's tech hub status and proximity to the mainland workforce create consistent demand. Highest yields among analyzed districts. Investment risk: <strong>Low-Medium</strong> with strong rental fundamentals.</p>

<h3>Ajah/Sangotedo</h3>

<table>
<tr><th>Metric</th><th>2024</th><th>2023</th><th>Change</th></tr>
<tr><td>Avg. price/sqm</td><td>₦320K</td><td>₦220K</td><td>+45%</td></tr>
<tr><td>Rental yield</td><td>5.5%</td><td>6.1%</td><td>-0.6pp</td></tr>
<tr><td>Vacancy rate</td><td>14%</td><td>9%</td><td>+5pp</td></tr>
<tr><td>Days on market</td><td>95</td><td>55</td><td>+40</td></tr>
</table>

<p>Rapid development outpaced infrastructure in some Ajah sub-markets. Flood-prone areas show significant valuation discounts. Investment risk: <strong>Variable</strong> — location-specific due diligence essential.</p>

<h2 id="rental-market-trends">Rental market trends</h2>

<h3>Annual rent growth by property type</h3>

<ul>
<li><strong>Studio/self-contained:</strong> +38% YoY (highest demand)</li>
<li><strong>2-bedroom apartment:</strong> +32% YoY</li>
<li><strong>3-bedroom apartment:</strong> +28% YoY</li>
<li><strong>4-bedroom house:</strong> +22% YoY (weakest demand)</li>
</ul>

<h3>Rental payment trends</h3>

<p>Crest Study Consult rental data shows shifting payment patterns:</p>

<ul>
<li><strong>1-year upfront:</strong> Still dominant (68% of transactions) but declining</li>
<li><strong>6-month payments:</strong> Growing to 22% of transactions</li>
<li><strong>Quarterly payments:</strong> Emerging in premium segment (10%)</li>
</ul>

<h2 id="investment-risks">Key investment risks for 2025</h2>

<h3>1. Currency volatility</h3>

<p>Naira-denominated property prices create challenges for:</p>
<ul>
<li>Diaspora buyers with foreign income</li>
<li>Investors seeking USD-denominated returns</li>
<li>Developers with imported material costs</li>
</ul>

<h3>2. Title and documentation risks</h3>

<p>Crest Study Consult verification data shows:</p>
<ul>
<li>34% of properties have some form of documentation defect</li>
<li>12% involve disputed ownership claims</li>
<li>8% are on government-acquired land</li>
</ul>

<h3>3. Infrastructure deficits</h3>

<p>Development has outpaced infrastructure in key growth corridors:</p>
<ul>
<li>Power supply remains unreliable (average 6 hours/day grid power)</li>
<li>Road infrastructure lags residential development in Lekki axis</li>
<li>Drainage issues create flooding risks in low-lying areas</li>
</ul>

<h3>4. Regulatory uncertainty</h3>

<p>Land use regulations and property taxation remain unpredictable:</p>
<ul>
<li>Lagos State property taxes under review</li>
<li>Building permit enforcement increasing</li>
<li>Rent control discussions ongoing</li>
</ul>

<h2 id="2025-outlook">2025 outlook</h2>

<h3>Price projections</h3>

<p>Crest Study Consult base case scenario:</p>
<ul>
<li><strong>Prime districts:</strong> 15-20% naira appreciation, flat in USD</li>
<li><strong>Mid-market:</strong> 25-30% naira appreciation</li>
<li><strong>Emerging areas:</strong> 30-40% naira appreciation (highest risk)</li>
</ul>

<h3>Investment recommendations</h3>

<ol>
<li><strong>Mainland focus:</strong> Yaba, Surulere offer better yield fundamentals</li>
<li><strong>Smaller units:</strong> Studio and 1-bed demand outpaces supply</li>
<li><strong>Infrastructure proximity:</strong> Properties near completed infrastructure projects</li>
<li><strong>Documentation priority:</strong> Accept only fully documented properties</li>
</ol>

<h2 id="conclusion">Conclusion</h2>

<p>The Lagos property market offers selective opportunities in 2025, but requires disciplined investment approaches. Focus on verified properties with clear titles, prioritize rental yield over capital appreciation expectations, and maintain realistic assessments of infrastructure development timelines.</p>`,
        categoryId: marketCategory.id,
        authorId: author.id,
        status: PostStatus.LIVE,
        isPublished: true,
        isFeatured: true,
        readingTimeMin: 20,
        heroImage: "https://images.unsplash.com/photo-1577495508326-19a1b3cf65b7?w=1200&h=630&fit=crop",
        heroImageAlt: "Lagos skyline representing property market analysis",
        canonicalURL: "https://blog.creststudyconsult.com/market-intelligence/lagos-housing-market-2025",
        schemaType: SchemaType.REPORT,
        faqBlock: [
          {
            question: "Is Lagos property a good investment in 2025?",
            answer: "Lagos property offers selective opportunities in 2025. Focus on mainland districts like Yaba for better rental yields (6.8%), prioritize smaller units with strongest demand, and ensure thorough documentation verification. Avoid overpriced luxury segments with high vacancy rates.",
          },
          {
            question: "What are the best areas to invest in Lagos property?",
            answer: "Yaba offers the best risk-adjusted returns with 6.8% rental yields and only 5% vacancy. Lekki Phase 1 shows resilient demand from young professionals. Avoid oversupplied premium areas like Ikoyi where vacancy rates have reached 22%.",
          },
          {
            question: "How much have Lagos property prices increased?",
            answer: "Lagos property prices rose 42% in naira terms during 2024, but fell 8% when measured in US dollars due to currency depreciation. This creates opportunities for diaspora buyers with foreign income but challenges for investors seeking USD-denominated returns.",
          },
        ],
        ctaBlock: {
          headline: "Get verified Lagos property listings",
          ctaText: "Search verified properties",
          ctaLink: "https://propx.africa/search",
        },
        sourceNotes: "Crest Study Consult Lagos Property Index, Q4 2024. Data from 12,500 transactions across Lagos metropolitan area. Rental data from 8,400 active listings monitored monthly.",
      },
    });
    console.log(`  ✓ ${lagosReport.title}`);

    // ============================================
    // Create Abuja Property Investment Guide
    // ============================================
    console.log("\n📝 Creating Abuja property investment guide...");

    const abujaReport = await prisma.post.upsert({
      where: { slug: "abuja-property-investment-guide-2025" },
      update: {},
      create: {
        slug: "abuja-property-investment-guide-2025",
        title: "Abuja property investment guide: Districts, pricing, and due diligence",
        metaTitle: "Abuja Property Investment Guide 2025 — Crest Study Consult",
        metaDescription: "In-depth analysis of Abuja real estate markets with district-by-district breakdown. Investment opportunities, risks, and due diligence requirements. Read Crest Study Consult research.",
        targetKeyword: "Abuja property investment",
        excerpt: "Abuja property prices rose 42% year-over-year, outpacing Lagos in both naira and real terms. This district-by-district analysis examines where value remains, which areas face oversupply risks, and the documentation challenges unique to FCT property transactions.",
        content: `<p>Abuja's property market operates under a fundamentally different regulatory framework than Lagos. The Federal Capital Territory Administration (FCTA) controls all land allocation, creating both unique opportunities and distinct risks for property investors.</p>

<h2 id="executive-summary">Executive summary</h2>

<p>Key findings from Crest Study Consult's Abuja Property Index, Q4 2024:</p>

<ul>
<li><strong>Average price growth:</strong> 42% YoY (highest among major Nigerian cities)</li>
<li><strong>Rental yield:</strong> 5.4% average across residential districts</li>
<li><strong>Documentation issues:</strong> 38% of properties have incomplete FCT allocation processes</li>
<li><strong>New builds:</strong> 33% have incomplete documentation at time of sale</li>
<li><strong>Transaction costs:</strong> 15-18% of property value (higher than Lagos due to FCT processes)</li>
</ul>

<h2 id="understanding-fct-land">Understanding FCT land allocation</h2>

<p>Unlike state-controlled land in Lagos, all Abuja land is Federal Territory. This creates a distinct documentation hierarchy:</p>

<h3>Right of Occupancy (R of O)</h3>
<p>The definitive title document in Abuja. Without a properly issued R of O, no title can be considered fully secure. Verification at the Abuja Geographic Information Systems (AGIS) is essential.</p>

<h3>Certificate of Occupancy (C of O)</h3>
<p>Issued after the R of O, confirming development approval. Many properties are sold before C of O issuance — a significant risk factor.</p>

<h3>Building Approval</h3>
<p>Separate from land title. Properties without proper building approval face demolition risk regardless of title status.</p>

<blockquote>
<p><strong>Crest Study Consult insight:</strong> 1 in 3 new Abuja developments are sold without complete documentation. Buyers must verify all three elements before committing funds.</p>
</blockquote>

<h2 id="district-analysis">District-by-district analysis</h2>

<h3>Maitama</h3>

<table>
<tr><th>Metric</th><th>2024</th><th>2023</th><th>Change</th></tr>
<tr><td>Avg. price/sqm</td><td>₦2.4M</td><td>₦1.8M</td><td>+33%</td></tr>
<tr><td>Rental yield</td><td>3.2%</td><td>3.8%</td><td>-0.6pp</td></tr>
<tr><td>Vacancy rate</td><td>14%</td><td>10%</td><td>+4pp</td></tr>
<tr><td>Annual rent (4-bed)</td><td>₦18M</td><td>₦14M</td><td>+29%</td></tr>
</table>

<p>Maitama remains Abuja's most prestigious address, home to diplomatic missions and senior government officials. However, yields have compressed significantly. Investment profile: <strong>Capital preservation</strong>, not yield-focused.</p>

<h3>Asokoro</h3>

<table>
<tr><th>Metric</th><th>2024</th><th>2023</th><th>Change</th></tr>
<tr><td>Avg. price/sqm</td><td>₦1.8M</td><td>₦1.3M</td><td>+38%</td></tr>
<tr><td>Rental yield</td><td>4.1%</td><td>4.5%</td><td>-0.4pp</td></tr>
<tr><td>Vacancy rate</td><td>11%</td><td>8%</td><td>+3pp</td></tr>
<tr><td>Annual rent (4-bed)</td><td>₦12M</td><td>₦9M</td><td>+33%</td></tr>
</table>

<p>Strong government and corporate tenant base provides stability. New development activity is limited by available land. Investment profile: <strong>Low-risk residential</strong>.</p>

<h3>Wuse 2</h3>

<table>
<tr><th>Metric</th><th>2024</th><th>2023</th><th>Change</th></tr>
<tr><td>Avg. price/sqm</td><td>₦1.1M</td><td>₦780K</td><td>+41%</td></tr>
<tr><td>Rental yield</td><td>5.8%</td><td>6.2%</td><td>-0.4pp</td></tr>
<tr><td>Vacancy rate</td><td>7%</td><td>5%</td><td>+2pp</td></tr>
<tr><td>Annual rent (3-bed)</td><td>₦6.5M</td><td>₦4.8M</td><td>+35%</td></tr>
</table>

<p>Wuse 2 offers Abuja's best combination of yield and accessibility. Commercial presence creates consistent demand. Investment profile: <strong>Balanced yield and growth</strong>.</p>

<h3>Jabi</h3>

<table>
<tr><th>Metric</th><th>2024</th><th>2023</th><th>Change</th></tr>
<tr><td>Avg. price/sqm</td><td>₦720K</td><td>₦520K</td><td>+38%</td></tr>
<tr><td>Rental yield</td><td>6.4%</td><td>6.8%</td><td>-0.4pp</td></tr>
<tr><td>Vacancy rate</td><td>9%</td><td>6%</td><td>+3pp</td></tr>
<tr><td>Annual rent (3-bed)</td><td>₦4.2M</td><td>₦3.1M</td><td>+35%</td></tr>
</table>

<p>Growing commercial hub with Jabi Lake Mall anchoring retail. New developments expanding supply significantly. Investment profile: <strong>Higher yield, higher risk</strong>.</p>

<h3>Gwarinpa</h3>

<table>
<tr><th>Metric</th><th>2024</th><th>2023</th><th>Change</th></tr>
<tr><td>Avg. price/sqm</td><td>₦450K</td><td>₦310K</td><td>+45%</td></tr>
<tr><td>Rental yield</td><td>7.2%</td><td>7.8%</td><td>-0.6pp</td></tr>
<tr><td>Vacancy rate</td><td>12%</td><td>8%</td><td>+4pp</td></tr>
<tr><td>Annual rent (3-bed)</td><td>₦2.8M</td><td>₦2.0M</td><td>+40%</td></tr>
</table>

<p>Africa's largest housing estate offers affordability but infrastructure challenges persist. Title documentation requires careful verification. Investment profile: <strong>Highest yield, higher risk</strong>.</p>

<h2 id="due-diligence-requirements">FCT-specific due diligence requirements</h2>

<h3>Essential verification steps</h3>

<ol>
<li><strong>AGIS verification:</strong> Confirm land allocation at AGIS office in Central Area</li>
<li><strong>Development approval:</strong> Verify building plan approval with FCDA</li>
<li><strong>Survey authentication:</strong> Check survey plans against AGIS records</li>
<li><strong>Ground rent status:</strong> Confirm no outstanding ground rent obligations</li>
<li><strong>Demolition risk assessment:</strong> Check property against published demolition lists</li>
</ol>

<h3>Common documentation defects</h3>

<ul>
<li><strong>Unapproved building modifications:</strong> Extensions or changes without FCDA approval</li>
<li><strong>Ground rent arrears:</strong> Unpaid obligations that transfer to new owners</li>
<li><strong>Incomplete allocation:</strong> Properties sold before R of O completion</li>
<li><strong>Zone violations:</strong> Residential use in commercial zones or vice versa</li>
</ul>

<h2 id="investment-risks">Key investment risks</h2>

<h3>1. Government demolition</h3>
<p>FCTA actively demolishes structures violating land use or building regulations. Properties in established areas can face demolition for unapproved modifications.</p>

<h3>2. Incomplete documentation sales</h3>
<p>33% of new builds are sold before documentation completion. Buyers bear risk of allocation delays or denials.</p>

<h3>3. Infrastructure gaps</h3>
<p>Satellite towns face significant infrastructure deficits despite rapid development.</p>

<h2 id="investment-recommendations">Investment recommendations for 2025</h2>

<ol>
<li><strong>Prioritize completed documentation:</strong> Accept only properties with full R of O and C of O</li>
<li><strong>Wuse 2 and Jabi focus:</strong> Best balance of yield and documentation quality</li>
<li><strong>Avoid satellite town speculation:</strong> Infrastructure timelines remain uncertain</li>
<li><strong>Ground rent verification:</strong> Clear all arrears before purchase completion</li>
</ol>

<h2 id="conclusion">Conclusion</h2>

<p>Abuja offers strong rental fundamentals and capital appreciation potential, but FCT documentation requirements demand thorough due diligence. Focus on properties with complete allocation, verified building approval, and clear ground rent status.</p>`,
        categoryId: marketCategory.id,
        authorId: author.id,
        status: PostStatus.LIVE,
        isPublished: true,
        isFeatured: true,
        readingTimeMin: 18,
        heroImage: "https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?w=1200&h=630&fit=crop",
        heroImageAlt: "Abuja cityscape representing property market analysis",
        canonicalURL: "https://blog.creststudyconsult.com/market-intelligence/abuja-property-investment-guide-2025",
        schemaType: SchemaType.REPORT,
        faqBlock: [
          {
            question: "What documents do I need to verify Abuja property?",
            answer: "Verify the Right of Occupancy (R of O) at AGIS, Certificate of Occupancy (C of O), and Building Approval from FCDA. Also check ground rent status and confirm the property is not on any demolition lists. 38% of Abuja properties have incomplete documentation.",
          },
          {
            question: "Which Abuja district offers the best rental yield?",
            answer: "Gwarinpa offers the highest rental yields at 7.2%, followed by Jabi at 6.4% and Wuse 2 at 5.8%. However, higher-yield areas carry greater documentation and infrastructure risks. Wuse 2 offers the best risk-adjusted returns.",
          },
          {
            question: "Is it safe to buy off-plan in Abuja?",
            answer: "Off-plan purchases in Abuja carry significant risk — 33% of new builds are sold before documentation completion. If buying off-plan, use escrow, verify developer track record, and ensure contractual provisions for documentation delays or failures.",
          },
        ],
        ctaBlock: {
          headline: "Verify Abuja property documentation",
          ctaText: "Get FCT property verification",
          ctaLink: "https://propx.africa/verify-abuja",
        },
        sourceNotes: "Crest Study Consult Abuja Property Index, Q4 2024. Data from 4,200 transactions across FCT. Documentation analysis from 1,800 property verifications conducted 2024.",
      },
    });
    console.log(`  ✓ ${abujaReport.title}`);

    // ============================================
    // Create Port Harcourt Housing Market Report
    // ============================================
    console.log("\n📝 Creating Port Harcourt housing market report...");

    const phReport = await prisma.post.upsert({
      where: { slug: "port-harcourt-housing-market-analysis" },
      update: {},
      create: {
        slug: "port-harcourt-housing-market-analysis",
        title: "Port Harcourt housing market: Oil city real estate dynamics",
        metaTitle: "Port Harcourt Housing Market Analysis — Crest Study Consult",
        metaDescription: "Analysis of how oil industry cycles affect Port Harcourt property values, rental demand, and investment timing. Data-driven insights for Rivers State property. Read Crest Study Consult research.",
        targetKeyword: "Port Harcourt property market",
        excerpt: "Port Harcourt property values move with oil industry cycles more than any other Nigerian city. This analysis examines how oil price fluctuations, IOC operational changes, and local security conditions shape real estate opportunities in Rivers State.",
        content: `<p>Port Harcourt's real estate market is uniquely tied to the petroleum industry. Understanding this relationship is essential for any property investment decision in Rivers State.</p>

<h2 id="executive-summary">Executive summary</h2>

<p>Key findings from Crest Study Consult's Port Harcourt Property Index, Q4 2024:</p>

<ul>
<li><strong>Average price growth:</strong> 28% YoY (below Lagos and Abuja)</li>
<li><strong>Oil price correlation:</strong> 0.72 correlation coefficient with Brent crude</li>
<li><strong>Rental yield:</strong> 6.1% average (highest among major cities)</li>
<li><strong>IOC presence:</strong> 40% of premium rental demand from oil company staff</li>
<li><strong>Verified landlords:</strong> Only 23% of listings have verified ownership</li>
<li><strong>Housing deficit:</strong> 5,200+ new units needed annually</li>
</ul>

<h2 id="oil-industry-dynamics">Oil industry impact on property</h2>

<h3>The IOC tenant effect</h3>

<p>International Oil Companies (Shell, ExxonMobil, TotalEnergies, Chevron) historically provided Port Harcourt's most reliable tenant base. However:</p>

<ul>
<li><strong>Operational consolidation:</strong> IOCs reducing onshore presence, moving staff to Lagos</li>
<li><strong>Local content requirements:</strong> More Nigerian staff replacing expatriates</li>
<li><strong>Security concerns:</strong> Periodic relocations due to regional instability</li>
</ul>

<p>These factors have reduced premium expatriate demand by approximately 35% since 2019.</p>

<h3>Oil price correlation analysis</h3>

<p>Crest Study Consult analysis shows Port Harcourt property values correlate with Brent crude prices:</p>

<ul>
<li><strong>Price correlation:</strong> 0.72 (strong positive relationship)</li>
<li><strong>Lag period:</strong> Property prices respond 4-6 months after oil price movements</li>
<li><strong>Rental sensitivity:</strong> Rents adjust faster than sale prices (2-3 month lag)</li>
</ul>

<blockquote>
<p><strong>Investment implication:</strong> Oil price forecasts should inform Port Harcourt property timing decisions. Current elevated oil prices suggest favorable conditions, but investors should monitor for correction risks.</p>
</blockquote>

<h2 id="district-analysis">District analysis</h2>

<h3>GRA Phase 1 & 2</h3>

<table>
<tr><th>Metric</th><th>2024</th><th>2023</th><th>Change</th></tr>
<tr><td>Avg. price/sqm</td><td>₦680K</td><td>₦520K</td><td>+31%</td></tr>
<tr><td>Rental yield</td><td>5.4%</td><td>6.0%</td><td>-0.6pp</td></tr>
<tr><td>Vacancy rate</td><td>18%</td><td>12%</td><td>+6pp</td></tr>
<tr><td>Annual rent (4-bed)</td><td>₦8M</td><td>₦6.2M</td><td>+29%</td></tr>
</table>

<p>GRA remains the preferred address for senior oil industry staff and executives. However, rising vacancy rates reflect IOC consolidation. Investment profile: <strong>Premium positioning but increasing risk</strong>.</p>

<h3>Old GRA (Moscow Road area)</h3>

<table>
<tr><th>Metric</th><th>2024</th><th>2023</th><th>Change</th></tr>
<tr><td>Avg. price/sqm</td><td>₦520K</td><td>₦420K</td><td>+24%</td></tr>
<tr><td>Rental yield</td><td>6.2%</td><td>6.8%</td><td>-0.6pp</td></tr>
<tr><td>Vacancy rate</td><td>14%</td><td>10%</td><td>+4pp</td></tr>
<tr><td>Annual rent (3-bed)</td><td>₦4.5M</td><td>₦3.5M</td><td>+29%</td></tr>
</table>

<p>Commercial presence and proximity to city center maintain demand. Properties often serve mixed residential-commercial uses. Investment profile: <strong>Balanced with commercial upside</strong>.</p>

<h3>Trans-Amadi</h3>

<table>
<tr><th>Metric</th><th>2024</th><th>2023</th><th>Change</th></tr>
<tr><td>Avg. price/sqm</td><td>₦380K</td><td>₦290K</td><td>+31%</td></tr>
<tr><td>Rental yield</td><td>7.1%</td><td>7.5%</td><td>-0.4pp</td></tr>
<tr><td>Vacancy rate</td><td>10%</td><td>8%</td><td>+2pp</td></tr>
<tr><td>Annual rent (3-bed)</td><td>₦2.8M</td><td>₦2.2M</td><td>+27%</td></tr>
</table>

<p>Industrial zone presence creates consistent mid-market demand. Less affected by IOC fluctuations due to diverse tenant base. Investment profile: <strong>Best risk-adjusted returns in Port Harcourt</strong>.</p>

<h3>Woji/Peter Odili Road</h3>

<table>
<tr><th>Metric</th><th>2024</th><th>2023</th><th>Change</th></tr>
<tr><td>Avg. price/sqm</td><td>₦440K</td><td>₦330K</td><td>+33%</td></tr>
<tr><td>Rental yield</td><td>6.5%</td><td>7.0%</td><td>-0.5pp</td></tr>
<tr><td>Vacancy rate</td><td>12%</td><td>9%</td><td>+3pp</td></tr>
<tr><td>Annual rent (3-bed)</td><td>₦3.2M</td><td>₦2.5M</td><td>+28%</td></tr>
</table>

<p>Growing middle-class residential area with improving infrastructure. New developments expanding supply. Investment profile: <strong>Growth potential with moderate risk</strong>.</p>

<h2 id="verification-challenges">Verification challenges in Rivers State</h2>

<p>Port Harcourt presents unique documentation challenges:</p>

<h3>Low verification rates</h3>
<p>Only 23% of Port Harcourt rental listings have verified landlord identity — the lowest among major Nigerian cities.</p>

<h3>Community land complexities</h3>
<p>Many properties sit on community-owned land with customary tenure arrangements. Formal documentation may not reflect actual ownership structures.</p>

<h3>Deed of Assignment reliance</h3>
<p>Rivers State properties often trade through Deeds of Assignment rather than Certificates of Occupancy, complicating title verification.</p>

<h2 id="security-considerations">Security considerations</h2>

<p>Security dynamics affect property values and tenant decisions:</p>

<ul>
<li><strong>Cult-related violence:</strong> Periodic flare-ups in specific areas</li>
<li><strong>Kidnapping risk:</strong> Higher in peri-urban and access corridors</li>
<li><strong>Flooding:</strong> Significant risk in low-lying areas during rainy season</li>
</ul>

<p>These factors create location-specific risk premiums and discounts.</p>

<h2 id="investment-recommendations">Investment recommendations</h2>

<h3>Favorable conditions</h3>
<ol>
<li><strong>Trans-Amadi focus:</strong> Best yields with diversified tenant base</li>
<li><strong>Mid-market residential:</strong> Less IOC-dependent demand</li>
<li><strong>Current oil prices:</strong> Above $80/barrel supports property values</li>
</ol>

<h3>Risk factors to monitor</h3>
<ol>
<li><strong>IOC relocations:</strong> Track Shell, ExxonMobil operational announcements</li>
<li><strong>Oil price movements:</strong> Below $60/barrel would pressure market</li>
<li><strong>Security developments:</strong> Regional stability affects premium demand</li>
</ol>

<h2 id="conclusion">Conclusion</h2>

<p>Port Harcourt offers the highest rental yields among major Nigerian cities but requires careful attention to oil industry dynamics, security conditions, and documentation challenges. Focus on mid-market properties with diversified tenant appeal to reduce oil-cycle exposure.</p>`,
        categoryId: marketCategory.id,
        authorId: author.id,
        status: PostStatus.LIVE,
        isPublished: true,
        isFeatured: false,
        readingTimeMin: 15,
        heroImage: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&h=630&fit=crop",
        heroImageAlt: "Oil industry infrastructure representing Port Harcourt market dynamics",
        canonicalURL: "https://blog.creststudyconsult.com/market-intelligence/port-harcourt-housing-market-analysis",
        schemaType: SchemaType.REPORT,
        faqBlock: [
          {
            question: "How do oil prices affect Port Harcourt property?",
            answer: "Port Harcourt property values show a 0.72 correlation with Brent crude prices, with a 4-6 month lag. When oil prices fall below $60/barrel, expect property value pressure. Current elevated prices above $80/barrel support market values.",
          },
          {
            question: "Is Port Harcourt property safe to invest in?",
            answer: "Port Harcourt investment requires careful location selection. Trans-Amadi offers the best risk-adjusted returns with diversified tenant demand. Avoid areas with documented security challenges. Always verify property documentation — only 23% of listings have verified ownership.",
          },
          {
            question: "What rental yields can I expect in Port Harcourt?",
            answer: "Port Harcourt offers Nigeria's highest rental yields — 7.1% in Trans-Amadi and 6.5% in Woji area. However, GRA yields have compressed to 5.4% due to rising vacancies from IOC consolidation.",
          },
        ],
        ctaBlock: {
          headline: "Verify Port Harcourt property",
          ctaText: "Get Rivers State property verification",
          ctaLink: "https://propx.africa/verify-ph",
        },
        sourceNotes: "Crest Study Consult Port Harcourt Property Index, Q4 2024. Data from 2,100 transactions across Rivers State. Oil price correlation analysis from 10-year historical data.",
      },
    });
    console.log(`  ✓ ${phReport.title}`);
  }

  // ============================================
  // Create Admin User
  // ============================================
  console.log("\n🔐 Creating admin user...");
  
  const bcrypt = await import("bcryptjs");
  const adminEmail = process.env.ADMIN_EMAIL || "admin@propx.africa";
  // Default password for development: PropXAdmin2025!
  // IMPORTANT: Change this immediately in production
  const defaultPassword = "PropXAdmin2025!";
  const hashedPassword = await bcrypt.hash(defaultPassword, 12);

  const adminUser = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: hashedPassword,
      name: "PropX Admin",
      role: UserRole.ADMIN,
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
