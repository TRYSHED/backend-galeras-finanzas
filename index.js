const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// --- MÓDULOS SPRINT 1 Y 2 (Usuarios, TRX, Balance, Tips) ---
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
        if (usuario.rows.length === 0) return res.status(401).json({ error: "Credenciales incorrectas" });
        
        const validPassword = await bcrypt.compare(password, usuario.rows[0].password_hash);
        if (!validPassword) return res.status(401).json({ error: "Credenciales incorrectas" });
        
        res.json({ mensaje: "Login exitoso", usuario_id: usuario.rows[0].id });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error en el servidor");
    }
});

// HU5 y HU6: Registrar ingreso o gasto
app.post('/api/transacciones', async (req, res) => {
    try {
        const { usuario_id, tipo, monto, categoria } = req.body;
        if (tipo !== 'INGRESO' && tipo !== 'GASTO') return res.status(400).json({ error: "El tipo debe ser INGRESO o GASTO" });
        
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

// HU7: Editar Transacción
app.put('/api/transacciones/:id', async (req, res) => {
    try {
        const { id } = req.params; 
        const { monto, categoria } = req.body;
        const transaccionActualizada = await pool.query(
            'UPDATE transacciones SET monto = $1, categoria = $2 WHERE id = $3 RETURNING *',
            [monto, categoria, id]
        );
        if (transaccionActualizada.rows.length === 0) return res.status(404).json({ error: "Transacción no encontrada" });
        res.json({ mensaje: "Transacción editada con éxito", transaccion: transaccionActualizada.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al editar transacción" });
    }
});

// HU7: Eliminar Transacción
app.delete('/api/transacciones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const transaccionEliminada = await pool.query('DELETE FROM transacciones WHERE id = $1 RETURNING *', [id]);
        if (transaccionEliminada.rows.length === 0) return res.status(404).json({ error: "Transacción no encontrada" });
        res.json({ mensaje: "Transacción eliminada correctamente" });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al eliminar transacción" });
    }
});

// HU10 y HU12: Obtener Balance y Estado de la Mascota
app.get('/api/balance/:usuario_id', async (req, res) => {
    try {
        const { usuario_id } = req.params;
        const result = await pool.query(
            `SELECT tipo, SUM(monto) as total FROM transacciones WHERE usuario_id = $1 GROUP BY tipo`,
            [usuario_id]
        );
        let ingresos = 0, gastos = 0;
        result.rows.forEach(fila => {
            if (fila.tipo === 'INGRESO') ingresos = parseFloat(fila.total);
            if (fila.tipo === 'GASTO') gastos = parseFloat(fila.total);
        });
        const balanceTotal = ingresos - gastos;
        let estadoMascota = balanceTotal < 0 ? "Hambrienta/Triste" : (balanceTotal === 0 ? "Neutral" : "Feliz");

        res.json({ usuario_id, ingresos, gastos, balance: balanceTotal, mascota: { estado: estadoMascota } });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al calcular el balance" });
    }
});

app.get('/api/tips', (req, res) => {
    const tips = [
        { id: 1, titulo: "Regla 50/30/20", descripcion: "Usa 50% para necesidades, 30% para gustos y 20% para ahorro." },
        { id: 2, titulo: "Gastos hormiga", descripcion: "Ese café diario suma mucho dinero al mes. ¡Lleva el registro!" }
    ];
    res.json(tips);
});

// ==========================================
// --- MÓDULOS SPRINT 3 (Metas, Perfil, Análisis Inteligente) ---
// ==========================================

// NUEVO - HU4 y HU18: Editar perfil y nivel educativo
app.put('/api/usuarios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // COALESCE permite que si el frontend no envía un dato, se conserve el que ya estaba en la BD
        const { nombre, nivel_educativo } = req.body;
        const usuarioActualizado = await pool.query(
            'UPDATE usuarios SET nombre = COALESCE($1, nombre), nivel_educativo = COALESCE($2, nivel_educativo) WHERE id = $3 RETURNING id, correo, nombre, nivel_educativo',
            [nombre, nivel_educativo, id]
        );
        if (usuarioActualizado.rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
        res.json({ mensaje: "Perfil actualizado", usuario: usuarioActualizado.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al actualizar perfil" });
    }
});

// NUEVO - HU9: Crear meta de ahorro
app.post('/api/metas', async (req, res) => {
    try {
        const { usuario_id, nombre_meta, monto_objetivo, fecha_limite } = req.body;
        const nuevaMeta = await pool.query(
            'INSERT INTO metas_ahorro (usuario_id, nombre_meta, monto_objetivo, fecha_limite) VALUES ($1, $2, $3, $4) RETURNING *',
            [usuario_id, nombre_meta, monto_objetivo, fecha_limite]
        );
        res.json({ mensaje: "Meta creada con éxito", meta: nuevaMeta.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al crear la meta" });
    }
});

// NUEVO - HU9: Obtener metas de un usuario
app.get('/api/metas/:usuario_id', async (req, res) => {
    try {
        const { usuario_id } = req.params;
        const metas = await pool.query('SELECT * FROM metas_ahorro WHERE usuario_id = $1', [usuario_id]);
        res.json(metas.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al obtener metas" });
    }
});

// NUEVO - HU19, HU20, HU22: Análisis de Patrones y Alertas Inteligentes
app.get('/api/analisis/:usuario_id', async (req, res) => {
    try {
        const { usuario_id } = req.params;

        // 1. Calcular el gasto total del mes
        const gastosMes = await pool.query(
            `SELECT SUM(monto) as total_gastos FROM transacciones 
             WHERE usuario_id = $1 AND tipo = 'GASTO' AND EXTRACT(MONTH FROM fecha) = EXTRACT(MONTH FROM CURRENT_DATE)`,
            [usuario_id]
        );
        const totalGastos = parseFloat(gastosMes.rows[0].total_gastos) || 0;

        // 2. Patrón de gasto: Encontrar la categoría en la que más gasta
        const categoriaMax = await pool.query(
            `SELECT categoria, SUM(monto) as total FROM transacciones 
             WHERE usuario_id = $1 AND tipo = 'GASTO' GROUP BY categoria ORDER BY total DESC LIMIT 1`,
            [usuario_id]
        );
        const patronGasto = categoriaMax.rows.length > 0 ? categoriaMax.rows[0] : null;

        // 3. Motor de Alertas (Reglas de negocio)
        let alertas = [];
        const PRESUPUESTO_LIMITE = 500000; // Esto simula el presupuesto configurado por el usuario
        
        if (totalGastos > PRESUPUESTO_LIMITE) {
            alertas.push({ tipo: "PRESUPUESTO", severidad: "ALTA", mensaje: `Has superado tu presupuesto de $${PRESUPUESTO_LIMITE}.` });
        }
        if (patronGasto && parseFloat(patronGasto.total) > (totalGastos * 0.5)) {
            alertas.push({ tipo: "PATRON_INUSUAL", severidad: "MEDIA", mensaje: `Atención: Más del 50% de tus gastos son en '${patronGasto.categoria}'.`});
        }

        res.json({
            usuario_id,
            total_gastos_mes: totalGastos,
            patron_principal: patronGasto,
            alertas
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al generar análisis" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Galeras Software Group corriendo en el puerto ${PORT}`);
});
