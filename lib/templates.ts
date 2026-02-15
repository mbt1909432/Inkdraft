// Document templates for quick start
// Each template has: id, name, description, category, icon, content

export interface DocumentTemplate {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  category: TemplateCategory;
  icon: string;
  content: string;
}

export type TemplateCategory = 'academic' | 'business' | 'creative' | 'life';

export const templateCategories: Record<TemplateCategory, { name: string; nameZh: string }> = {
  academic: { name: 'Academic', nameZh: '留学/学术' },
  business: { name: 'Business', nameZh: '职场/商务' },
  creative: { name: 'Creative', nameZh: '内容创作' },
  life: { name: 'Life', nameZh: '生活/个人' },
};

export const documentTemplates: DocumentTemplate[] = [
  // ========== Academic Templates ==========
  {
    id: 'cv-academic',
    name: 'Academic CV',
    nameZh: '学术简历 CV',
    description: 'Academic curriculum vitae for graduate school applications',
    descriptionZh: '研究生申请用的学术简历模板',
    category: 'academic',
    icon: '📋',
    content: `# [Your Name]

## Contact Information
- **Email:** your.email@example.com
- **Phone:** +86 xxx xxxx xxxx
- **Location:** City, Country
- **LinkedIn:** linkedin.com/in/yourname
- **Personal Website:** yourwebsite.com

---

## Education

### [University Name] — [City, Country]
**[Degree], [Major]** | *[Month Year] - [Month Year]*
- GPA: x.xx/4.0
- Relevant Coursework: Course 1, Course 2, Course 3
- Honors: Dean's List, Scholarship Name

### [Previous University] — [City, Country]
**[Degree], [Major]** | *[Month Year] - [Month Year]*
- GPA: x.xx/4.0
- Thesis: "Your Thesis Title"

---

## Research Experience

### [Research Lab/Project Name] | *[Month Year] - Present*
**Research Assistant** | [University/Institution]
- Conducted research on [topic], resulting in [outcome]
- Developed [method/tool] to analyze [subject]
- Collaborated with a team of X researchers on [project]

### [Another Research Project] | *[Month Year] - [Month Year]*
**Independent Researcher** | [Institution]
- Investigated [research question]
- Applied [methodology] to analyze [data/samples]
- Findings presented at [conference/publication]

---

## Publications

1. **[Your Name]**, Co-author Name. "[Paper Title]." *[Journal Name]*, Volume(Issue), Pages, Year.
2. **[Your Name]**, et al. "[Paper Title]." *Conference Name*, Year.

---

## Presentations

- "[Presentation Title]" — [Conference/Seminar Name], [Location], [Month Year]
- "[Presentation Title]" — [Event Name], [Location], [Month Year]

---

## Skills

**Programming:** Python, R, MATLAB, SQL, JavaScript
**Tools:** LaTeX, Git, SPSS, Tableau, AWS
**Languages:** Mandarin (Native), English (Fluent), [Other Language]

---

## Awards & Honors

- [Award Name], [Organization], [Year]
- [Scholarship Name], [University], [Year]
- [Competition/Honor], [Year]

---

## Teaching Experience

### [Course Name] | [University]
**Teaching Assistant** | *[Semester, Year]*
- Led weekly discussion sections for X students
- Graded assignments and provided feedback
- Held office hours to assist students

---

## Professional Affiliations

- Member, [Professional Organization Name]
- [Other relevant memberships]
`,
  },
  {
    id: 'personal-statement',
    name: 'Personal Statement',
    nameZh: '个人陈述',
    description: 'Personal statement for graduate school application',
    descriptionZh: '研究生申请个人陈述模板',
    category: 'academic',
    icon: '✍️',
    content: `# Personal Statement

## Program: [Program Name]
## University: [University Name]

---

### Introduction

[Start with a compelling hook—a personal anecdote, a question, or a realization that sparked your interest in this field. This should be 2-3 sentences that capture the reader's attention.]

[Follow with a brief statement of your purpose: what do you want to study and why?]

---

### Academic Background

[Discuss your undergraduate studies and how they prepared you for this program.]

- Major in [Your Major] at [University Name]
- Key courses that built your foundation: [Course 1], [Course 2], [Course 3]
- Notable academic achievements: [GPA, awards, honors]

[Describe a significant academic project or research experience that demonstrates your capabilities.]

---

### Research Experience

[Detail your research experience, emphasizing skills relevant to the program.]

**[Research Project Title]** | [Lab/Institution]
- [Describe your role and responsibilities]
- [Explain methodologies used]
- [Highlight key findings or contributions]
- [Mention any publications or presentations]

[Connect this experience to your future research interests.]

---

### Professional Experience (if applicable)

[Describe relevant work experience, internships, or industry projects.]

**[Position]** | [Company/Organization]
- [Key responsibility 1]
- [Key responsibility 2]
- [Skills developed or applied]

---

### Research Interests

[Clearly articulate your research interests and how they align with the program.]

I am particularly interested in researching:
1. [Research Interest 1]
2. [Research Interest 2]
3. [Research Interest 3]

[Explain why these topics matter to you and to the field.]

---

### Why This Program?

[Be specific about why you chose this program and university.]

- **Faculty:** I am eager to work with Professor [Name] whose research on [topic] aligns with my interests in [your interest].
- **Resources:** The [specific lab/center/facility] would provide invaluable resources for my research.
- **Curriculum:** Courses such as [Course 1] and [Course 2] directly address the skills I wish to develop.
- **Community:** [Mention any specific aspects of the program community or culture that appeal to you.]

---

### Career Goals

[Outline your short-term and long-term career objectives.]

**Short-term (1-3 years after graduation):**
[Your immediate post-graduation plans]

**Long-term (5-10 years):**
[Your ultimate career aspirations]

[Explain how this program will help you achieve these goals.]

---

### Conclusion

[Summarize your key qualifications and reiterate your enthusiasm for the program.]

[End with a forward-looking statement about what you hope to contribute to the field.]

---

*Word Count: [Update after writing]*
`,
  },
  {
    id: 'statement-of-purpose',
    name: 'Statement of Purpose',
    nameZh: '研究目的陈述 SoP',
    description: 'Statement of Purpose for PhD/graduate applications',
    descriptionZh: '博士/研究生申请研究目的陈述',
    category: 'academic',
    icon: '🎯',
    content: `# Statement of Purpose

## Applicant: [Your Name]
## Program: [PhD/Master's] in [Field]
## Institution: [University Name]

---

### Opening: Your Research Identity

[Begin with a clear statement of your research interests and intellectual journey. 1-2 paragraphs.]

My research lies at the intersection of [Field 1] and [Field 2], with a particular focus on [specific topic]. This interest emerged from [origin story—course, project, experience] and has evolved through [key experiences that shaped your thinking].

---

### Academic Foundation

[Establish your credentials and preparation.]

**Undergraduate Studies at [University]**
- Major: [Your Major]
- Key coursework: [List relevant courses]
- Thesis/Capstone: "[Title]" — [Brief description and findings]

**Research Preparation**
[Discuss specific skills, methodologies, and knowledge you've acquired.]

---

### Research Experience

[This is the heart of your SoP—demonstrate your ability to conduct research.]

#### [Research Project 1]
**[Project Title]** | [Lab/Institution] | [Dates]
- **Problem:** [What question were you trying to answer?]
- **Method:** [What approach did you take?]
- **Contribution:** [What did you accomplish?]
- **Outcome:** [Publications, presentations, or impact]

#### [Research Project 2]
[Follow similar structure for additional projects]

---

### Proposed Research Direction

[Articulate the research you want to pursue in graduate school.]

**Research Question:**
[State the central question or problem you want to investigate.]

**Significance:**
[Explain why this research matters—to the field, to society, to knowledge.]

**Approach:**
[Outline how you might tackle this research—methodologies, frameworks, etc.]

---

### Fit with [University Name]

[Be specific about why this program is the right place for your research.]

**Faculty Alignment:**
- Professor [Name]: Their work on [topic] relates to my interest in [your interest]
- Professor [Name]: Their expertise in [area] would support my research on [topic]

**Resources & Opportunities:**
- [Specific lab, center, or facility]
- [Unique program features]
- [Collaborative opportunities]

**Curriculum:**
[Highlight specific courses or training that would benefit your research.]

---

### Career Trajectory

**Immediate Goals:**
Upon completing the [PhD/Master's] program, I plan to [immediate post-graduation plans].

**Long-term Vision:**
My ultimate career goal is to [long-term aspirations]. I hope to contribute to the field by [specific contributions you want to make].

---

### Closing

[Reaffirm your commitment and readiness.]

[End with confidence about what you will contribute to the program.]

---

*Note: A strong SoP is typically 1-2 pages (500-1000 words). Adjust length according to each program's requirements.*
`,
  },
  {
    id: 'recommendation-letter-request',
    name: 'Recommendation Letter Guide',
    nameZh: '推荐信请求指南',
    description: 'Template for requesting recommendation letters',
    descriptionZh: '向教授请求推荐信的邮件模板',
    category: 'academic',
    icon: '📨',
    content: `# Recommendation Letter Request Guide

## Email Template to Professor

---

**Subject:** Request for Letter of Recommendation - [Your Name]

---

Dear Professor [Last Name],

I hope this email finds you well. I am writing to ask if you would be willing to write a letter of recommendation for my [graduate school/job] application to [Program/Company Name].

**Background:**
I was a student in your [Course Name] course during [Semester, Year], where I [specific project or achievement]. I also [mention any additional interactions: research assistant, office hours discussions, thesis advisor, etc.].

**Why I'm Asking You:**
[Explain why this professor's recommendation would be valuable—what they observed about your abilities, character, or potential.]

**Application Details:**
- **Program/Position:** [Name]
- **Institution/Company:** [Name]
- **Deadline:** [Date]
- **Submission Method:** [Email/Online portal]

**Materials Attached:**
- [ ] My CV/Resume
- [ ] Personal Statement/Statement of Purpose
- [ ] Transcript
- [ ] List of programs I'm applying to
- [ ] Any forms required for recommenders

**Additional Context:**
[Optional: Share key points you hope they might address—specific projects, skills demonstrated, growth observed.]

I would be happy to meet at your convenience to discuss my application further. I understand this is a busy time of year, and I genuinely appreciate your consideration.

Thank you for your time and for the impact you've had on my academic journey.

Best regards,
[Your Name]
[Your Email]
[Your Phone Number]

---

## Information to Provide Your Recommender

### About You
- Current status and contact information
- How long and in what capacity they've known you
- Your key achievements in their course/lab

### About Your Goals
- Why you're pursuing this path
- What programs/positions you're applying to
- Your timeline and deadlines

### Supporting Documents
1. **CV/Resume** - comprehensive overview
2. **Transcripts** - academic record
3. **Personal Statement draft** - your story and goals
4. **List of programs** - with deadlines and submission details
5. **Key points to address** - specific examples you'd like highlighted

---

## Timeline Recommendations

| Timeframe | Action |
|-----------|--------|
| 4-6 weeks before deadline | Send initial request |
| 3-4 weeks before | Follow up with materials |
| 2 weeks before | Gentle reminder |
| 1 week before | Final reminder (if needed) |
| After deadline | Send thank you note |

---

## Follow-up Reminder Template

**Subject:** Reminder: Recommendation Letter - [Your Name]

Dear Professor [Last Name],

I wanted to follow up on my request for a letter of recommendation for [Program Name]. The deadline is [Date], and I wanted to ensure you have everything you need.

Please let me know if you need any additional information or materials.

Thank you again for your support.

Best regards,
[Your Name]

---

## Thank You Note Template (After Submission)

**Subject:** Thank You - [Your Name]

Dear Professor [Last Name],

I wanted to express my sincere gratitude for writing a letter of recommendation on my behalf. I truly appreciate the time and effort you took to support my application.

I will keep you updated on the outcome of my application.

Thank you again for your guidance and support throughout my academic journey.

Warm regards,
[Your Name]
`,
  },
  {
    id: 'research-proposal',
    name: 'Research Proposal',
    nameZh: '研究计划书',
    description: 'Research proposal template for PhD applications',
    descriptionZh: '博士申请研究计划书模板',
    category: 'academic',
    icon: '🔬',
    content: `# Research Proposal

## Title: [Your Research Title]

**Applicant:** [Your Name]
**Proposed Program:** [PhD in Field]
**Target Institution:** [University Name]
**Date:** [Month Year]

---

## 1. Abstract

[Provide a 150-250 word summary of your proposed research, including:]
- Research problem
- Objectives
- Methodology
- Expected contributions

---

## 2. Introduction & Background

### 2.1 Research Context
[Establish the broader context of your research area.]

### 2.2 Problem Statement
[Clearly articulate the specific problem or gap your research addresses.]

### 2.3 Motivation
[Explain why this research is important and timely.]

---

## 3. Literature Review

### 3.1 Current State of Knowledge
[Summarize key works and findings in your research area.]

### 3.2 Research Gaps
[Identify what remains unknown or unexplored.]

| Author (Year) | Contribution | Gap/Limitation |
|---------------|--------------|----------------|
| [Author 1]    | [Finding]    | [Limitation]   |
| [Author 2]    | [Finding]    | [Limitation]   |

### 3.3 How Your Research Addresses These Gaps
[Connect your proposed work to the identified gaps.]

---

## 4. Research Questions & Objectives

### 4.1 Primary Research Question
[State your main research question clearly.]

### 4.2 Sub-questions
1. [Sub-question 1]
2. [Sub-question 2]
3. [Sub-question 3]

### 4.3 Research Objectives
By the end of this research, I aim to:
1. [Objective 1]
2. [Objective 2]
3. [Objective 3]

---

## 5. Theoretical Framework

[Describe the theoretical foundation that will guide your research.]

- **Primary Theory:** [Name and brief explanation]
- **Supporting Concepts:** [Relevant concepts or frameworks]
- **Application:** [How these theories inform your approach]

---

## 6. Methodology

### 6.1 Research Design
[Describe your overall research approach—qualitative, quantitative, or mixed methods.]

### 6.2 Data Collection
| Method | Purpose | Sample Size |
|--------|---------|-------------|
| [Method 1] | [Purpose] | [Size] |
| [Method 2] | [Purpose] | [Size] |

### 6.3 Data Analysis
[Explain how you will analyze the collected data.]

### 6.4 Timeline

| Phase | Duration | Activities |
|-------|----------|------------|
| Phase 1 | Months 1-6 | Literature review, methodology refinement |
| Phase 2 | Months 7-12 | Data collection |
| Phase 3 | Months 13-18 | Data analysis |
| Phase 4 | Months 19-24 | Writing and revision |

---

## 7. Expected Contributions

### 7.1 Theoretical Contributions
[How will your research advance theoretical understanding?]

### 7.2 Practical Contributions
[How might your findings be applied in practice?]

### 7.3 Broader Impact
[What is the potential broader impact on society or the field?]

---

## 8. Feasibility & Resources

### 8.1 Required Resources
- [Resource 1: e.g., specific equipment, software]
- [Resource 2: e.g., participant recruitment]
- [Resource 3: e.g., institutional support]

### 8.2 Potential Challenges & Mitigation
| Challenge | Mitigation Strategy |
|-----------|---------------------|
| [Challenge 1] | [Strategy] |
| [Challenge 2] | [Strategy] |

---

## 9. References

[Include key references in your field's standard format.]

1. [Reference 1]
2. [Reference 2]
3. [Reference 3]

---

*Note: Research proposals for PhD applications are typically 1,000-2,000 words. Check specific program requirements.*
`,
  },

  // ========== Business Templates ==========
  {
    id: 'weekly-report',
    name: 'Weekly Report',
    nameZh: '周报',
    description: 'Weekly work summary template',
    descriptionZh: '工作周报模板',
    category: 'business',
    icon: '📊',
    content: `# 周报 | Weekly Report

**姓名 Name:** [Your Name]
**部门 Department:** [Department]
**周期 Period:** [Start Date] - [End Date]

---

## 本周完成 Work Completed

### 主要工作 Main Tasks
1. **[Task Title]**
   - 完成情况：[已完成/进行中/待确认]
   - 产出/成果：[Deliverables]
   - 备注：[Additional notes]

2. **[Task Title]**
   - 完成情况：
   - 产出/成果：
   - 备注：

### 关键成果 Key Achievements
- [Achievement 1]
- [Achievement 2]
- [Achievement 3]

---

## 进行中工作 Work in Progress

| 项目 Project | 进度 Progress | 预计完成 ETA | 负责人 Owner |
|-------------|---------------|--------------|--------------|
| [Project 1] | 60% | [Date] | [Name] |
| [Project 2] | 30% | [Date] | [Name] |

---

## 遇到的问题 Issues & Blockers

### 问题 1: [Issue Title]
- **描述 Description:** [What happened]
- **影响 Impact:** [How it affects work]
- **解决方案 Proposed Solution:** [Your suggestion]
- **需要的支持 Support Needed:** [What help you need]

---

## 下周计划 Next Week's Plan

### 优先事项 Priorities
1. [Priority 1]
2. [Priority 2]
3. [Priority 3]

### 详细计划 Detailed Plan

| 任务 Task | 预计时间 Est. Time | 交付物 Deliverable |
|-----------|-------------------|-------------------|
| [Task 1] | [Hours/Days] | [Deliverable] |
| [Task 2] | [Hours/Days] | [Deliverable] |

---

## 需要的支持 Support Required

- [ ] [Support request 1]
- [ ] [Support request 2]

---

## 备注 Remarks

[Any additional information or notes]
`,
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    nameZh: '会议纪要',
    description: 'Meeting minutes template',
    descriptionZh: '会议纪要模板',
    category: 'business',
    icon: '📝',
    content: `# 会议纪要 | Meeting Notes

**会议主题 Meeting Title:** [Title]
**日期 Date:** [YYYY-MM-DD]
**时间 Time:** [Start Time] - [End Time]
**地点 Location:** [Location / Zoom Link]
**记录人 Note Taker:** [Name]

---

## 参会人员 Attendees

| 姓名 Name | 部门 Department | 角色 Role |
|-----------|----------------|-----------|
| [Name 1] | [Dept] | [Role] |
| [Name 2] | [Dept] | [Role] |
| [Name 3] | [Dept] | [Role] |

**缺席 Absent:** [Names]

---

## 会议议程 Agenda

1. [Agenda Item 1]
2. [Agenda Item 2]
3. [Agenda Item 3]

---

## 讨论内容 Discussion

### 议题 1: [Topic Title]

**背景 Background:**
[Brief context]

**讨论要点 Key Points:**
- [Point 1]
- [Point 2]
- [Point 3]

**决策 Decision:**
[What was decided]

---

### 议题 2: [Topic Title]

**背景 Background:**

**讨论要点 Key Points:**
- [Point 1]
- [Point 2]

**决策 Decision:**

---

## 行动项 Action Items

| 编号 # | 任务 Task | 负责人 Owner | 截止日期 Due Date | 状态 Status |
|--------|-----------|--------------|------------------|-------------|
| 1 | [Task description] | [Name] | [Date] | [Pending/Done] |
| 2 | [Task description] | [Name] | [Date] | [Pending/Done] |
| 3 | [Task description] | [Name] | [Date] | [Pending/Done] |

---

## 下次会议 Next Meeting

**日期 Date:** [Date]
**时间 Time:** [Time]
**议题 Topics:** [Planned topics]

---

## 附件 Attachments

- [ ] [Attachment 1]
- [ ] [Attachment 2]

---

*会议纪要发送给: [Distribution list]*
`,
  },

  // ========== Creative Templates ==========
  {
    id: 'blog-post',
    name: 'Blog Post',
    nameZh: '博客文章',
    description: 'Technical blog post structure',
    descriptionZh: '技术博客文章结构模板',
    category: 'creative',
    icon: '✏️',
    content: `# [Blog Post Title]

**作者 Author:** [Your Name]
**发布日期 Publish Date:** [YYYY-MM-DD]
**标签 Tags:** [tag1, tag2, tag3]
**阅读时间 Reading Time:** X min read

---

## 引言 Introduction

[Hook: Start with an interesting question, statistic, or statement that grabs attention.]

[Context: Briefly explain what this post is about and why it matters.]

[Preview: What will readers learn by the end?]

---

## 背景知识 Background

[Provide necessary context for readers who may be new to the topic.]

### 前置知识 Prerequisites
- Familiarity with [concept 1]
- Basic understanding of [concept 2]
- [Tool/library] installed

---

## 正文 Main Content

### 第一部分: [Section 1 Title]

[Content for section 1]

\`\`\`javascript
// Code example
const example = "Hello World";
console.log(example);
\`\`\`

> **提示 Tip:** [Helpful tip related to the content]

---

### 第二部分: [Section 2 Title]

[Content for section 2]

#### 子标题 Subsection

[Detailed explanation]

| Option | Pros | Cons |
|--------|------|------|
| Option A | [Pro] | [Con] |
| Option B | [Pro] | [Con] |

---

### 第三部分: [Section 3 Title]

[Content for section 3]

**步骤 Steps:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

---

## 实战示例 Real-World Example

[Walk through a practical example that demonstrates the concepts covered.]

\`\`\`javascript
// Complete example code
\`\`\`

---

## 常见问题 Common Issues & Solutions

### 问题 1: [Issue]
**解决方案 Solution:** [How to fix it]

### 问题 2: [Issue]
**解决方案 Solution:** [How to fix it]

---

## 最佳实践 Best Practices

1. **[Best Practice 1]**
   [Explanation]

2. **[Best Practice 2]**
   [Explanation]

3. **[Best Practice 3]**
   [Explanation]

---

## 总结 Summary

[Recap the key points covered in the post.]

### 关键要点 Key Takeaways
- [Takeaway 1]
- [Takeaway 2]
- [Takeaway 3]

---

## 扩展阅读 Further Reading

- [Resource 1](link)
- [Resource 2](link)
- [Resource 3](link)

---

## 关于作者 About the Author

[Your bio - 2-3 sentences about who you are and what you do.]

---

*如果你觉得这篇文章有帮助，欢迎分享！If you found this post helpful, please share it!*
`,
  },
  {
    id: 'reading-notes',
    name: 'Reading Notes',
    nameZh: '读书笔记',
    description: 'Book/article reading notes template',
    descriptionZh: '读书笔记模板',
    category: 'creative',
    icon: '📚',
    content: `# 读书笔记 | Reading Notes

**书名/文章 Book/Article:** [Title]
**作者 Author:** [Author Name]
**阅读日期 Date:** [Start Date] - [End Date]
**推荐指数 Rating:** ⭐⭐⭐⭐⭐ (5/5)

---

## 基本信息 Overview

- **类型 Genre:** [Non-fiction/Fiction/Technical/etc.]
- **页数 Pages:** [Number]
- **出版年份 Year:** [Year]
- **标签 Tags:** [tag1, tag2, tag3]

---

## 一句话总结 One-Sentence Summary

[Summarize the book in one sentence]

---

## 为什么读这本书 Why I Read This

[What prompted you to read this book? What questions were you hoping to answer?]

---

## 核心观点 Key Ideas

### 观点 1: [Idea Title]
[Explanation of the idea]
- **关键引用 Quote:** "[Memorable quote]"
- **我的思考 My Thoughts:** [Your reflection]

### 观点 2: [Idea Title]
[Explanation of the idea]
- **关键引用 Quote:** "[Memorable quote]"
- **我的思考 My Thoughts:** [Your reflection]

### 观点 3: [Idea Title]
[Explanation of the idea]
- **关键引用 Quote:** "[Memorable quote]"
- **我的思考 My Thoughts:** [Your reflection]

---

## 章节笔记 Chapter Notes

### 第一章: [Chapter Title]
[Key points from this chapter]
- [Point 1]
- [Point 2]
- [Point 3]

### 第二章: [Chapter Title]
[Key points from this chapter]
- [Point 1]
- [Point 2]

---

## 精彩摘录 Favorite Quotes

1. "[Quote 1]"
   — [Page number]

2. "[Quote 2]"
   — [Page number]

3. "[Quote 3]"
   — [Page number]

---

## 实践应用 Practical Applications

[How can you apply what you learned?]

1. **[Application 1]**
   [Specific action you can take]

2. **[Application 2]**
   [Specific action you can take]

---

## 改变我认知的观点 Mind-Changing Ideas

[What ideas challenged or changed your thinking?]

- [Idea 1]: [How it changed your perspective]
- [Idea 2]: [How it changed your perspective]

---

## 行动清单 Action Items

- [ ] [Action item 1]
- [ ] [Action item 2]
- [ ] [Action item 3]

---

## 相关推荐 Related Recommendations

如果你喜欢这本书，你可能也会喜欢：
- [Book 1] by [Author]
- [Book 2] by [Author]

---

## 个人评价 Personal Review

### 优点 Pros
- [Pro 1]
- [Pro 2]

### 缺点 Cons
- [Con 1]
- [Con 2]

### 适合人群 Who Should Read This
[Description of the ideal reader]

---

## 最后的话 Final Thoughts

[Your overall impression and key takeaway from reading this book]
`,
  },
];

// Helper function to get templates by category
export function getTemplatesByCategory(category: TemplateCategory): DocumentTemplate[] {
  return documentTemplates.filter((t) => t.category === category);
}

// Helper function to get template by id
export function getTemplateById(id: string): DocumentTemplate | undefined {
  return documentTemplates.find((t) => t.id === id);
}
