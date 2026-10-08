import { useEffect, useMemo, useState } from 'react';
import { api, downloadPdf, ESTADO_TURNO, horaCorta } from '../api/client';
import { etiquetaSemana, lunesDe, nombreDiaCorto, sumarDias } from '../utils/fecha';
import { esDiaHabil, hoyLocal, HORARIOS, HORARIOS_MANANA, HORARIOS_TARDE, proximoDiaHabil } from '../utils/agenda';
import { Alert, Badge, Field, Modal } from '../components/ui';
import { BuscadorPaciente } from '../components/BuscadorPaciente';

const emptyForm = {
  id_paciente: '',
  id_usuario: '',
  fecha_turno: '',
  hora_turno: '',
  motivo: '',
  estado: 'pendiente'
};

const DIAS = [0, 1, 2, 3, 4];

export function Turnos() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pacientes, setPacientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [lunes, setLunes] = useState(() => lunesDe(hoyLocal()));
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const hoy = hoyLocal();
  const viernes = sumarDias(lunes, 4);
  const dias = DIAS.map((offset) => sumarDias(lunes, offset));

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ desde: lunes, hasta: viernes });
      if (estadoFiltro) params.set('estado', estadoFiltro);
      const data = await api(`/api/turnos?${params}`);
      setItems(data.turnos || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api('/api/pacientes').then((d) => setPacientes(d.pacientes));
    api('/api/auth/profesionales').then((d) => setUsuarios(d.usuarios));
  }, []);

  useEffect(() => { load().catch((err) => setError(err.message)); }, [lunes, estadoFiltro]);

  const porCelda = useMemo(() => {
    const mapa = new Map();
    items.forEach((item) => {
      const clave = `${String(item.fecha_turno).slice(0, 10)}|${horaCorta(item.hora_turno)}`;
      const lista = mapa.get(clave) || [];
      lista.push(item);
      mapa.set(clave, lista);
    });
    return mapa;
  }, [items]);

  function openNew() {
    setEditing(null);
    setError('');
    setForm({
      ...emptyForm,
      id_usuario: usuarios[0]?.id_usuario || '',
      fecha_turno: proximoDiaHabil()
    });
    setOpen(true);
  }

  function openSlot(fecha, hora) {
    if (fecha < hoy) return;
    setEditing(null);
    setError('');
    setForm({
      ...emptyForm,
      id_usuario: usuarios[0]?.id_usuario || '',
      fecha_turno: fecha,
      hora_turno: hora
    });
    setOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setError('');
    setForm({
      id_paciente: item.id_paciente,
      id_usuario: item.id_usuario,
      fecha_turno: String(item.fecha_turno).slice(0, 10),
      hora_turno: horaCorta(item.hora_turno),
      motivo: item.motivo || '',
      estado: item.estado
    });
    setOpen(true);
  }

  function fechaValida(fecha) {
    const original = editing ? String(editing.fecha_turno).slice(0, 10) : '';
    if (fecha < hoy && fecha !== original) {
      return 'No se pueden fijar turnos en una fecha anterior a hoy.';
    }
    if (!esDiaHabil(fecha)) return 'Los turnos son solo de lunes a viernes.';
    return '';
  }

  function cambiarFecha(fecha) {
    setForm({ ...form, fecha_turno: fecha });
    setError(fecha ? fechaValida(fecha) : '');
  }

  async function save(e) {
    e.preventDefault();
    const mensajeFecha = fechaValida(form.fecha_turno);
    if (mensajeFecha) {
      setError(mensajeFecha);
      return;
    }
    setError('');
    if (!HORARIOS.includes(form.hora_turno)) {
      setError('Elegí un horario de la mañana (8:00 a 11:30) o de la tarde (15:00 a 20:00).');
      return;
    }
    try {
      if (editing) {
        await api(`/api/turnos/${editing.id_turno}`, { method: 'PUT', body: form });
      } else {
        await api('/api/turnos', { method: 'POST', body: form });
      }
      setOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cambiarEstado(item, estado) {
    if (estado === item.estado) return;
    setError('');
    try {
      await api(`/api/turnos/${item.id_turno}`, {
        method: 'PUT',
        body: {
          id_paciente: item.id_paciente,
          id_usuario: item.id_usuario,
          fecha_turno: String(item.fecha_turno).slice(0, 10),
          hora_turno: horaCorta(item.hora_turno),
          motivo: item.motivo || '',
          estado
        }
      });
      setItems((prev) => prev.flatMap((row) => {
        if (row.id_turno !== item.id_turno) return [row];
        if (estadoFiltro && estadoFiltro !== estado) return [];
        return [{ ...row, estado }];
      }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(item) {
    if (!confirm('¿Dar de baja este turno?')) return;
    await api(`/api/turnos/${item.id_turno}`, { method: 'DELETE' });
    setOpen(false);
    await load();
  }

  async function exportar() {
    const params = new URLSearchParams({ desde: lunes, hasta: viernes });
    if (estadoFiltro) params.set('estado', estadoFiltro);
    await downloadPdf(`/api/turnos/pdf?${params}`, 'agenda-turnos.pdf');
  }

  function filas(horas) {
    return horas.flatMap((hora) => [
      <div className="cal-time" key={`${hora}-hora`}>{hora}</div>,
      ...dias.map((fecha) => {
        const turnos = porCelda.get(`${fecha}|${hora}`) || [];
        const pasado = fecha < hoy;
        return (
          <div
            className={`cal-cell${fecha === hoy ? ' is-today' : ''}${pasado ? ' is-past' : ''}`}
            key={`${fecha}-${hora}`}
            onClick={() => openSlot(fecha, hora)}
          >
            {turnos.map((item) => (
              <div
                className={`cal-event estado-${item.estado}`}
                key={item.id_turno}
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  openEdit(item);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.stopPropagation();
                    openEdit(item);
                  }
                }}
              >
                <strong>{item.paciente_apellido}, {item.paciente_nombre}</strong>
                <span>{item.profesional_nombre} {item.profesional_apellido}</span>
                {item.motivo && <em>{item.motivo}</em>}
                {pasado ? (
                  <Badge value={item.estado} />
                ) : (
                  <select
                    className="estado-select"
                    aria-label={`Estado de ${item.paciente_apellido}, ${item.paciente_nombre}`}
                    value={item.estado}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => cambiarEstado(item, event.target.value)}
                  >
                    {ESTADO_TURNO.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
        );
      })
    ]);
  }

  return (
    <>
      {error && !open && <Alert type="error">{error}</Alert>}
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button className="btn btn-ghost" type="button" onClick={() => setLunes(lunesDe(hoy))}>Hoy</button>
          <button className="btn btn-ghost" type="button" onClick={() => setLunes(sumarDias(lunes, -7))} aria-label="Semana anterior">‹</button>
          <button className="btn btn-ghost" type="button" onClick={() => setLunes(sumarDias(lunes, 7))} aria-label="Semana siguiente">›</button>
          <h2>{etiquetaSemana(lunes)}</h2>
        </div>
        <Field label="Estado">
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
            <option value="">Todos</option>
            {ESTADO_TURNO.map((estado) => <option key={estado}>{estado}</option>)}
          </select>
        </Field>
        <button className="btn btn-primary" type="button" onClick={openNew}>Nuevo turno</button>
        <button className="btn btn-secondary" type="button" onClick={exportar}>Exportar agenda PDF</button>
      </div>
      <div className="card cal-card">
        {loading && <p className="cal-loading">Cargando la semana…</p>}
        {!loading && items.length === 0 && <p className="cal-loading">Esta semana no tiene turnos.</p>}
        <div className="cal-scroll">
          <div className="cal-grid">
            <div className="cal-corner" />
            {dias.map((fecha) => (
              <div className={`cal-head${fecha === hoy ? ' is-today' : ''}`} key={fecha}>
                <span>{nombreDiaCorto(fecha)}</span>
                <strong>{Number(fecha.slice(8, 10))}</strong>
              </div>
            ))}
            {filas(HORARIOS_MANANA)}
            <div className="cal-break">Tarde · desde las 15:00</div>
            {filas(HORARIOS_TARDE)}
          </div>
        </div>
      </div>
      {open && (
        <Modal title={editing ? 'Modificar turno' : 'Alta de turno'} onClose={() => setOpen(false)}>
          <form onSubmit={save}>
            <Field label="Paciente" hint="Buscá por apellido, nombre o DNI.">
              <BuscadorPaciente
                pacientes={pacientes}
                value={form.id_paciente}
                onChange={(id) => setForm({ ...form, id_paciente: id })}
                required
              />
            </Field>
            <Field label="Profesional asignado">
              <select value={form.id_usuario} onChange={(e) => setForm({ ...form, id_usuario: e.target.value })} required>
                <option value="">Seleccione</option>
                {usuarios.map((u) => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre} {u.apellido}</option>)}
              </select>
            </Field>
            <div className="grid grid-2">
              <Field label="Fecha" hint="Desde hoy, de lunes a viernes.">
                <input
                  type="date"
                  min={editing && String(editing.fecha_turno).slice(0, 10) < hoy ? undefined : hoy}
                  value={form.fecha_turno}
                  onChange={(e) => cambiarFecha(e.target.value)}
                  required
                />
              </Field>
              <Field label="Hora" hint="Cada 30 minutos.">
                <select value={form.hora_turno} onChange={(e) => setForm({ ...form, hora_turno: e.target.value })} required>
                  <option value="">Seleccione</option>
                  <optgroup label="Mañana">
                    {HORARIOS_MANANA.map((hora) => <option key={hora} value={hora}>{hora}</option>)}
                  </optgroup>
                  <optgroup label="Tarde">
                    {HORARIOS_TARDE.map((hora) => <option key={hora} value={hora}>{hora}</option>)}
                  </optgroup>
                </select>
              </Field>
            </div>
            {error && <Alert type="error">{error}</Alert>}
            <Field label="Motivo"><textarea value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} /></Field>
            <Field label="Estado" hint={String(form.fecha_turno).slice(0, 10) < hoy ? 'El estado de un turno anterior a hoy no se modifica.' : ''}>
              <select
                value={form.estado}
                disabled={String(form.fecha_turno).slice(0, 10) < hoy}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                {ESTADO_TURNO.map((estado) => <option key={estado}>{estado}</option>)}
              </select>
            </Field>
            <div className="cal-form-actions">
              {editing && (
                <button className="btn btn-danger" type="button" onClick={() => remove(editing)}>Dar de baja</button>
              )}
              <button className="btn btn-primary" type="submit">Guardar turno</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
