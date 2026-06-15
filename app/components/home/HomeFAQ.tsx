import { cn } from "~/utils/cn";
import { FAQBlock } from "~/components/blog/FAQBlock";

interface HomeFAQProps {
  className?: string;
}

/**
 * Homepage FAQ / Knowledge Centre
 * PRD Section 6.3: 5 accordion questions from target keyword set
 */
export function HomeFAQ({ className }: HomeFAQProps) {
  const faqs = [
    {
      question: "How do I choose the right country to study abroad?",
      answer: "Compare destinations on four factors: tuition and living costs, visa requirements and difficulty, post-study work rights, and the strength of your chosen course. Crest Study Consult counsels students through this comparison based on academic profile and budget, with current guidance for the UK, US, Canada, Australia, Germany, and Ireland.",
    },
    {
      question: "What documents do I need for an international university application?",
      answer: "Most universities require academic transcripts, proof of English proficiency (such as IELTS or TOEFL), a personal statement, academic or professional references, and a copy of your passport. Specific requirements vary by country and programme, so confirm each institution's checklist before you apply.",
    },
    {
      question: "How does the student visa process work?",
      answer: "After receiving an offer and accepting a place, you typically need a letter of acceptance, proof of funds, and a valid passport to apply for a student visa. Each destination has its own route — for example, the UK Student visa, the US F-1, and the Canadian study permit — with different processing times and biometric steps.",
    },
    {
      question: "Are scholarships available for international students?",
      answer: "Yes. Funding ranges from full scholarships to partial tuition waivers offered by governments, universities, and external organisations. Eligibility usually depends on academic merit, course, and destination. Crest Study Consult helps students identify and apply for scholarships suited to their profile.",
    },
    {
      question: "How can Crest Study Consult help with my application?",
      answer: "Crest Study Consult guides students from first contact to settlement abroad — shortlisting institutions, preparing applications and documents, advising on visa requirements, and identifying scholarships. The aim is a seamless journey from dream to destination with trusted, personalized support at every step.",
    },
  ];

  return (
    <section className={cn("py-12 lg:py-16", className)}>
      <div className="container-blog">
        <div className="max-w-3xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900">
              Common questions about studying abroad
            </h2>
            <p className="mt-2 text-gray-600">
              Answers from Crest Study Consult
            </p>
          </div>

          {/* FAQ Accordion */}
          <FAQBlock faqs={faqs} />
        </div>
      </div>
    </section>
  );
}
