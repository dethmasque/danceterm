const express = require('express');
const path = require('path');
const app = express();
const port = 8080;
const setNoStore = (res) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
};

// /static is used for running locally with node
app.use('/static', express.static(path.join(__dirname, 'static'), { setHeaders: setNoStore }));
app.use('/public', express.static(path.join(__dirname, 'public'), { setHeaders: setNoStore }));
app.get('/', (req, res) => {
    // maintain two root HTML pages per run / deployment type for now
    setNoStore(res);
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});
app.listen(port, () => {
    console.log(`Application available at http://localhost:${port}`);
});
