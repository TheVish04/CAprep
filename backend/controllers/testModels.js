const { Groq } = require("groq-sdk");
require('dotenv').config({path: __dirname + '/../.env'});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const getModels = async () => {
  return await groq.models.list();
};

getModels().then((models) => {
  models.data.forEach(model => {
      console.log(`${model.id}`);
  });
}).catch(e => console.error(e.message));
