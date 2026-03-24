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

app.post('/api/registro', async (req, res) => {
    try {
        const { correo, password } = req.body;
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const nuevoUsuario = await pool.query(
            'INSERT INTO usuarios (correo, password_hash) VALUES ($1, $2) RETURNING id, correo',
            [correo, passwordHash]
        );

        // Al registrar al usuario, le creamos automáticamente su mascota virtual
        await pool.query('INSERT INTO mascotas (usuario_id) VALUES ($1)', [nuevoUsuario.rows[0].id]);

        res.json({ mensaje: "Usuario registrado con éxito", usuario: nuevoUsuario.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al registrar el usuario. Puede que el correo ya exista." });
    }
});

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

        // Actualizar mascota en BD según balance
        let estadoMascota = balanceTotal < 0 ? "Hambrienta/Triste" : (balanceTotal === 0 ? "Neutral" : "Feliz");
        await pool.query('UPDATE mascotas SET estado_salud = $1 WHERE usuario_id = $2', [estadoMascota, usuario_id]);

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

app.put('/api/usuarios/:id', async (req, res) => {
    try {
        const { id } = req.params;
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

app.get('/api/analisis/:usuario_id', async (req, res) => {
    try {
        const { usuario_id } = req.params;
        const gastosMes = await pool.query(
            `SELECT SUM(monto) as total_gastos FROM transacciones 
             WHERE usuario_id = $1 AND tipo = 'GASTO' AND EXTRACT(MONTH FROM fecha) = EXTRACT(MONTH FROM CURRENT_DATE)`,
            [usuario_id]
        );
        const totalGastos = parseFloat(gastosMes.rows[0].total_gastos) || 0;

        const categoriaMax = await pool.query(
            `SELECT categoria, SUM(monto) as total FROM transacciones 
             WHERE usuario_id = $1 AND tipo = 'GASTO' GROUP BY categoria ORDER BY total DESC LIMIT 1`,
            [usuario_id]
        );
        const patronGasto = categoriaMax.rows.length > 0 ? categoriaMax.rows[0] : null;

        let alertas = [];
        const PRESUPUESTO_LIMITE = 500000;

        if (totalGastos > PRESUPUESTO_LIMITE) {
            alertas.push({ tipo: "PRESUPUESTO", severidad: "ALTA", mensaje: `Has superado tu presupuesto de $${PRESUPUESTO_LIMITE}.` });
        }
        if (patronGasto && parseFloat(patronGasto.total) > (totalGastos * 0.5)) {
            alertas.push({ tipo: "PATRON_INUSUAL", severidad: "MEDIA", mensaje: `Atención: Más del 50% de tus gastos son en '${patronGasto.categoria}'.` });
        }

        res.json({ usuario_id, total_gastos_mes: totalGastos, patron_principal: patronGasto, alertas });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al generar análisis" });
    }
});

// ==========================================
// --- MÓDULOS SPRINT 4 (Reportes, Suscripciones, Gamificación, Seguridad) ---
// ==========================================

// HU11: Reportes Gráficos (Devuelve datos agrupados para pintar la gráfica en Swift)
app.get('/api/reportes/:usuario_id', async (req, res) => {
    try {
        const { usuario_id } = req.params;
        // Agrupa todos los gastos del mes actual por categoría
        const reporte = await pool.query(
            `SELECT categoria, SUM(monto) as total 
             FROM transacciones 
             WHERE usuario_id = $1 AND tipo = 'GASTO' 
             AND EXTRACT(MONTH FROM fecha) = EXTRACT(MONTH FROM CURRENT_DATE)
             GROUP BY categoria 
             ORDER BY total DESC`,
            [usuario_id]
        );
        res.json({ usuario_id, reporte: reporte.rows });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al generar el reporte gráfico" });
    }
});

// HU8: Crear Suscripción (Netflix, Spotify, etc.)
app.post('/api/suscripciones', async (req, res) => {
    try {
        const { usuario_id, nombre_servicio, monto, fecha_proximo_cobro } = req.body;
        const nuevaSuscripcion = await pool.query(
            'INSERT INTO suscripciones (usuario_id, nombre_servicio, monto, fecha_proximo_cobro) VALUES ($1, $2, $3, $4) RETURNING *',
            [usuario_id, nombre_servicio, monto, fecha_proximo_cobro]
        );
        res.json({ mensaje: "Suscripción registrada", suscripcion: nuevaSuscripcion.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al registrar suscripción" });
    }
});

// HU8: Obtener Suscripciones
app.get('/api/suscripciones/:usuario_id', async (req, res) => {
    try {
        const { usuario_id } = req.params;
        const suscripciones = await pool.query('SELECT * FROM suscripciones WHERE usuario_id = $1', [usuario_id]);
        res.json(suscripciones.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al obtener suscripciones" });
    }
});

// HU13 y HU15: Obtener información completa de la Mascota y Logros
app.get('/api/mascota/:usuario_id', async (req, res) => {
    try {
        const { usuario_id } = req.params;
        const mascota = await pool.query('SELECT * FROM mascotas WHERE usuario_id = $1', [usuario_id]);

        // Obtener logros desbloqueados
        const logros = await pool.query(
            `SELECT l.nombre, l.descripcion, l.puntos_recompensa, ul.fecha_desbloqueo 
             FROM usuario_logro ul 
             JOIN logros l ON ul.logro_id = l.id 
             WHERE ul.usuario_id = $1`,
            [usuario_id]
        );

        res.json({
            mascota: mascota.rows[0] || null,
            logros_desbloqueados: logros.rows
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al obtener datos de gamificación" });
    }
});

// HU15: Personalizar mascota (Ponerle accesorios)
app.put('/api/mascota/:usuario_id/personalizar', async (req, res) => {
    try {
        const { usuario_id } = req.params;
        const { accesorios } = req.body; // Ej: "Gafas de sol, Sombrero"
        const mascotaActualizada = await pool.query(
            'UPDATE mascotas SET accesorios = $1 WHERE usuario_id = $2 RETURNING *',
            [accesorios, usuario_id]
        );
        res.json({ mensaje: "Mascota personalizada", mascota: mascotaActualizada.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al personalizar mascota" });
    }
});

// HU3: Recuperar Contraseña (Simulación académica)
app.post('/api/recuperar-password', async (req, res) => {
    try {
        const { correo } = req.body;
        const usuario = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);

        if (usuario.rows.length === 0) {
            return res.status(404).json({ error: "No existe una cuenta con este correo" });
        }

        // Generamos una clave temporal por motivos académicos
        const claveTemporal = "Temporal" + Math.floor(Math.random() * 10000);
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(claveTemporal, saltRounds);

        // Actualizamos en BD
        await pool.query('UPDATE usuarios SET password_hash = $1 WHERE correo = $2', [passwordHash, correo]);

        res.json({
            mensaje: "Se ha generado una clave temporal para tu cuenta. En un entorno real, esto llegaría por correo.",
            clave_temporal_asignada: claveTemporal
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Error al recuperar contraseña" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Galeras Software Group corriendo en el puerto ${PORT}`);
});
