// One-shot seeder: creates a demo quiz with 5 MCQs on the "Computer & Internet Basics" course.
// Run with: node seed_demo_quiz.js
import { connectDB, sequelize } from "./DB/DBconnection.js";
import AcademyCourseContent from "./models/academyCourseContentModel.js";
import AcademyQuizQuestion from "./models/academyQuizQuestionModel.js";

const COURSE_TITLE = "Computer & Internet Basics";

const DEMO_QUIZ = {
  title: "Demo Quiz: Computer Basics",
  description: "A 5-question warm-up quiz to verify the quiz feature end-to-end.",
  body:
    "Read each question and pick the best answer.\n\n" +
    "- Correct answers earn full marks.\n" +
    "- Take your time — there is no time limit on this demo.\n" +
    "- You can re-attempt to improve your score.",
  time_limit_minutes: 0,
  attempts_allowed: 0,
  grading_method: "Highest grade",
};

const DEMO_QUESTIONS = [
  {
    question_text:
      "Which component of a computer is often referred to as the 'brain' because it executes instructions?",
    options: [
      "Central Processing Unit (CPU)",
      "Random Access Memory (RAM)",
      "Hard Disk Drive (HDD)",
      "Motherboard",
    ],
    correct_index: 0,
  },
  {
    question_text:
      "Which type of memory loses its contents when the power is turned off?",
    options: [
      "Read-Only Memory (ROM)",
      "Random Access Memory (RAM)",
      "Solid State Drive (SSD)",
      "Flash Memory",
    ],
    correct_index: 1,
  },
  {
    question_text: "Which of the following is system software, not application software?",
    options: [
      "Microsoft Word",
      "Google Chrome",
      "Operating System (e.g. Windows, Linux)",
      "VLC Media Player",
    ],
    correct_index: 2,
  },
  {
    question_text: "How many bits make up a single byte?",
    options: ["4", "8", "16", "1024"],
    correct_index: 1,
  },
  {
    question_text:
      "Which unit inside the CPU is responsible for arithmetic and logic operations like 'AND' or 'OR'?",
    options: [
      "Control Unit (CU)",
      "Arithmetic Logic Unit (ALU)",
      "Register File",
      "Cache",
    ],
    correct_index: 1,
  },
];

const run = async () => {
  try {
    await connectDB();
    await AcademyCourseContent.sync();
    await AcademyQuizQuestion.sync();

    // Avoid duplicates: skip if an item with the same course + title already exists.
    const existing = await AcademyCourseContent.findOne({
      where: { course: COURSE_TITLE, title: DEMO_QUIZ.title },
    });

    let quizRow;
    if (existing) {
      console.log(`Demo quiz already exists (id=${existing.id}). Refreshing questions only.`);
      quizRow = existing;
      await AcademyQuizQuestion.destroy({ where: { content_id: existing.id } });
    } else {
      quizRow = await AcademyCourseContent.create({
        course: COURSE_TITLE,
        section: "General",
        type: "quiz",
        ...DEMO_QUIZ,
      });
      console.log(`Created demo quiz (id=${quizRow.id}) on course "${COURSE_TITLE}".`);
    }

    for (let i = 0; i < DEMO_QUESTIONS.length; i++) {
      const q = DEMO_QUESTIONS[i];
      await AcademyQuizQuestion.create({
        content_id: quizRow.id,
        question_text: q.question_text,
        options: q.options,
        correct_index: q.correct_index,
        sort_order: i,
      });
    }
    console.log(`Inserted ${DEMO_QUESTIONS.length} MCQs.`);
    console.log(`\nDone. Students can attempt at: /quiz/${quizRow.id}/attempt`);
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
};

run();
