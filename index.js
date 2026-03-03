const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- MÓDULO USUARIOS (Sprint 1) ---

// HU1: Registro de usuario
app.post('/api/registro', async (req, res) => {
    try {
        const { correo, password } = req.body;
        // Encriptar la contraseña por seguridad
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const nuevoUsuario = await pool.query(
            'INSERT INTO usuarios (correo, password_hash) VALUES ($1, $2) RETURNING id, correo',
            [correo, passwordHash]
        );
        res.json({ mensaje: "Usuario registrado con éxito", usuario: nuevoUsuario.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al registrar el usuario. Puede que el correo ya exista." });
    }
});

// HU2: Iniciar sesión
app.post('/api/login', async (req, res) => {
    try {
        const { correo, password } = req.body;
        const usuario = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);

        if (usuario.rows.length === 0) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }

        const validPassword = await bcrypt.compare(password, usuario.rows[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }

        res.json({ mensaje: "Login exitoso", usuario_id: usuario.rows[0].id });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error en el servidor");
    }
});

// --- MÓDULO TRANSACCIONES (Sprint 1) ---

// HU5 y HU6: Registrar ingreso o gasto
app.post('/api/transacciones', async (req, res) => {
    try {
        const { usuario_id, tipo, monto, categoria } = req.body;

        // Validación básica
        if (tipo !== 'INGRESO' && tipo !== 'GASTO') {
            return res.status(400).json({ error: "El tipo debe ser INGRESO o GASTO" });
        }

        const nuevaTransaccion = await pool.query(
            'INSERT INTO transacciones (usuario_id, tipo, monto, categoria) VALUES ($1, $2, $3, $4) RETURNING *',
            [usuario_id, tipo, monto, categoria]
        );
        res.json({ mensaje: "Transacción registrada", transaccion: nuevaTransaccion.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al registrar la transacción" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Galeras Software Group corriendo en el puerto ${PORT}`);
});