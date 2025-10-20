const express = require('express');
const app = express();
const { connection } = require('./config/config.db');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});