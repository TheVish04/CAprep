require('dotenv').config();
const mongoose = require('mongoose');
const Question = require('./models/QuestionModel');
const Resource = require('./models/ResourceModel');

async function seedData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        const resourceData = {
            title: "Test Accounting MTP May 2024 Unlinked",
            subject: "1 - Accounting",
            paperType: "MTP",
            year: "2024",
            month: "May",
            examStage: "Foundation",
            fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            fileType: "pdf",
            resourceType: "pdf"
        };

        const newResource = await Resource.create(resourceData);
        console.log('Created Test Resource:', newResource._id);

        const questionData = {
            subject: "1 - Accounting",
            paperType: "MTP",
            year: "2024",
            month: "May",
            examStage: "Foundation",
            questionNumber: "TEST-UNLINKED-1",
            questionText: "This is an unlinked test question to verify PDF mapping.",
            difficulty: "medium"
        };

        const newQuestion = await Question.create(questionData);
        console.log('Created Unlinked Test Question:', newQuestion._id);

        console.log('Seeding complete. You can now test it in the UI.');
    } catch (error) {
        console.error('Error seeding data:', error);
    } finally {
        mongoose.connection.close();
    }
}

seedData();
