const express = require('express');
const path = require('path');
const app = express();
const port = 8080;

// /static is used for running locally with node
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    // maintain two root HTML pages per run / deployment type for now
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});
app.listen(port, () => {
    console.log(`Application available at http://localhost:${port}`);
});