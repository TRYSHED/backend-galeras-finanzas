const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// --- MÓDULO USUARIOS (Sprint 1) ---
// ==========================================

// HU1: Registro de usuario
app.post('/api/registro', async (req, res) => {
    try {
        const { correo, password } = req.body;
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

// ==========================================
// --- MÓDULO TRANSACCIONES (Sprint 1 y 2) ---
// ==========================================

// HU5 y HU6: Registrar ingreso o gasto
app.post('/api/transacciones', async (req, res) => {
    try {
        const { usuario_id, tipo, monto, categoria } = req.body;
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

// NUEVO - HU7: Editar Transacción
app.put('/api/transacciones/:id', async (req, res) => {
    try {
        const { id } = req.params; // El ID viene en la URL
        const { monto, categoria } = req.body;
        
        const transaccionActualizada = await pool.query(
            'UPDATE transacciones SET monto = $1, categoria = $2 WHERE id = $3 RETURNING *',
            [monto, categoria, id]
        );

        if (transaccionActualizada.rows.length === 0) {
            return res.status(404).json({ error: "Transacción no encontrada" });
        }
        res.json({ mensaje: "Transacción editada con éxito", transaccion: transaccionActualizada.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al editar transacción" });
    }
});

// NUEVO - HU7: Eliminar Transacción
app.delete('/api/transacciones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const transaccionEliminada = await pool.query(
            'DELETE FROM transacciones WHERE id = $1 RETURNING *', [id]
        );

        if (transaccionEliminada.rows.length === 0) {
            return res.status(404).json({ error: "Transacción no encontrada" });
        }
        res.json({ mensaje: "Transacción eliminada correctamente" });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al eliminar transacción" });
    }
});

// ==========================================
// --- MÓDULO ANÁLISIS Y MASCOTA (Sprint 2) ---
// ==========================================

// NUEVO - HU10 y HU12: Obtener Balance y Estado de la Mascota
app.get('/api/balance/:usuario_id', async (req, res) => {
    try {
        const { usuario_id } = req.params;
        
        // Sumar ingresos y gastos directamente con SQL
        const result = await pool.query(
            `SELECT tipo, SUM(monto) as total FROM transacciones WHERE usuario_id = $1 GROUP BY tipo`,
            [usuario_id]
        );

        let ingresos = 0;
        let gastos = 0;

        result.rows.forEach(fila => {
            if (fila.tipo === 'INGRESO') ingresos = parseFloat(fila.total);
            if (fila.tipo === 'GASTO') gastos = parseFloat(fila.total);
        });

        const balanceTotal = ingresos - gastos;

        // Lógica de HU12: Estado de la Mascota según el balance
        let estadoMascota = "Feliz";
        if (balanceTotal < 0) estadoMascota = "Hambrienta/Triste";
        else if (balanceTotal === 0) estadoMascota = "Neutral";

        res.json({ 
            usuario_id,
            ingresos, 
            gastos, 
            balance: balanceTotal,
            mascota: { estado: estadoMascota }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al calcular el balance" });
    }
});

// ==========================================
// --- MÓDULO EDUCACIÓN FINANCIERA (Sprint 2) ---
// ==========================================

// NUEVO - HU17: Obtener Tips Financieros
app.get('/api/tips', (req, res) => {
    // Para el Sprint 2, un arreglo estático es la forma más eficiente y rápida
    const tips = [
        { id: 1, titulo: "Regla 50/30/20", descripcion: "Usa 50% para necesidades, 30% para gustos y 20% para ahorro." },
        { id: 2, titulo: "Cuidado con los gastos hormiga", descripcion: "Ese café diario suma mucho dinero al mes. ¡Lleva el registro!" },
        { id: 3, titulo: "Fondo de emergencia", descripcion: "Intenta ahorrar al menos para cubrir 3 meses de tus gastos fijos." }
    ];
    res.json(tips);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Galeras Software Group corriendo en el puerto ${PORT}`);
});
