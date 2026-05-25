// One-shot seeder: adds a demo assignment/task to the "Computer & Internet Basics" course.
// Run with: node seed_demo_task.js
import { connectDB } from "./DB/DBconnection.js";
import AcademyCourseContent from "./models/academyCourseContentModel.js";

const COURSE_TITLE = "Computer & Internet Basics";

const DEMO_TASK = {
  title: "Demo Task: Identify Computer Components",
  description: "Short written assignment to practice identifying hardware parts.",
  body:
    "Submit a 1-page document covering the following:\n\n" +
    "1. List 5 internal components of a computer and describe what each one does.\n" +
    "2. Explain the difference between RAM and a Hard Disk Drive (HDD) in your own words.\n" +
    "3. Give one real-world example of input, output, and storage devices.\n\n" +
    "Submission format: PDF or DOCX. Upload via the assignment submission box.\n" +
    "Deadline: 7 days from the date this task is opened.",
};

const run = async () => {
  try {
    await connectDB();
    await AcademyCourseContent.sync();

    const existing = await AcademyCourseContent.findOne({
      where: { course: COURSE_TITLE, title: DEMO_TASK.title },
    });
    if (existing) {
      existing.body = DEMO_TASK.body;
      existing.description = DEMO_TASK.description;
      await existing.save();
      console.log(`Updated existing demo task (id=${existing.id}).`);
    } else {
      const row = await AcademyCourseContent.create({
        course: COURSE_TITLE,
        section: "General",
        type: "assignment",
        sort_order: 0,
        ...DEMO_TASK,
      });
      console.log(`Created demo task (id=${row.id}) on course "${COURSE_TITLE}".`);
    }
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
};

run();
