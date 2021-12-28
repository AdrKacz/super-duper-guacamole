require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const {sendMessages} = require('./src/firebase');

const app = express();
const port = process.env.SERVER_PORT;

app.use(cors());
app.use(bodyParser.json()); // for parsing application/json

app.post('/notifications', async (req, res) => {
  const tokens = req.body.tokens || [];
  await sendMessages(tokens);
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Firebase App listening at port ${port}`);
});
