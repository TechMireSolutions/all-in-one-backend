// One-shot seeder: adds a demo YouTube video to the "Computer & Internet Basics" course.
// Run with: node seed_demo_video.js
import { connectDB } from "./DB/DBconnection.js";
import AcademyCourseContent from "./models/academyCourseContentModel.js";

const COURSE_TITLE = "Computer & Internet Basics";

const DEMO_VIDEO = {
  title: "Demo Video: What is a Computer?",
  description: "Short intro video — covers the basics of how a computer works.",
  url: "https://www.youtube.com/watch?v=Cu3R5it4cQs",
};

const run = async () => {
  try {
    await connectDB();
    await AcademyCourseContent.sync();

    const existing = await AcademyCourseContent.findOne({
      where: { course: COURSE_TITLE, title: DEMO_VIDEO.title },
    });
    if (existing) {
      existing.url = DEMO_VIDEO.url;
      existing.description = DEMO_VIDEO.description;
      await existing.save();
      console.log(`Updated existing demo video (id=${existing.id}).`);
    } else {
      const row = await AcademyCourseContent.create({
        course: COURSE_TITLE,
        section: "General",
        type: "url",
        sort_order: 0,
        ...DEMO_VIDEO,
      });
      console.log(`Created demo video (id=${row.id}) on course "${COURSE_TITLE}".`);
    }
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
};

run();
