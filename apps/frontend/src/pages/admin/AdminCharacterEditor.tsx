/**
 * AdminCharacterEditor.tsx
 *
 * Full animation editor for a single character skin.
 *
 * Layout:
 *   ┌─ Sidebar ─┐  ┌─────────── Main ──────────────────────────────┐
 *   │ 17 actions │  │  Frame strip + FPS control + preview button   │
 *   │  (status)  │  │  ─────────────────────────────────────────── │
 *   │            │  │  Layer Composer                                │
 *   │            │  │    canvas 1254×1254 (scaled)  │  layer list   │
 *   └────────────┘  └───────────────────────────────────────────────┘
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAdminStore } from '../../stores/adminStore'
import styles from './AdminCharacterEditor.module.css'

const API = import.meta.env.VITE_API_URL ?? '/api/v1'

// ── Constants ──────────────────────────────────────────────────────────────────

const ACTIONS = [
  'idle', 'ready', 'walk_forward', 'walk_backward',
  'attack', 'heavy', 'ranged', 'shield', 'dodge',
  'hit', 'special', 'ko', 'victory',
  'repair', 'combo', 'utility_cast', 'charge',
] as const

type ActionName = typeof ACTIONS[number]

const ACTION_LABELS: Record<ActionName, string> = {
  idle:         'Idle (стоит)',
  ready:        'Ready (стойка)',
  walk_forward: 'Walk forward',
  walk_backward:'Walk backward',
  attack:       'Attack (удар)',
  heavy:        'Heavy (тяжёлый)',
  ranged:       'Ranged (дальний)',
  shield:       'Shield (блок)',
  dodge:        'Dodge (уклон)',
  hit:          'Hit (получил удар)',
  special:      'Special (спецудар)',
  ko:           'KO (падение)',
  victory:      'Victory (победа)',
  repair:       'Repair (восстановление)',
  combo:        'Combo',
  utility_cast: 'Utility cast',
  charge:       'Charge (заряд)',
}

const CANVAS_SIZE = 1254

// ── Types ──────────────────────────────────────────────────────────────────────

interface LayerMeta {
  url:     string   // server URL of the uploaded layer PNG
  name:    string
  visible: boolean
}

interface ActionDef {
  fps:    number
  frames: string[]
  layers?: LayerMeta[][]   // layers[i] = original layer stack for frame i
}

interface SkinDef {
  id:      string
  characterId: string
  name:    string
  actions: Record<string, ActionDef>
}

interface Layer {
  id:        string
  name:      string
  src:       string     // local objectURL for canvas preview
  serverUrl: string     // server URL after upload (empty = uploading)
  uploading: boolean
  visible:   boolean
  img:       HTMLImageElement
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminCharacterEditor() {
  const { characterId } = useParams<{ characterId: string }>()
  const token = useAdminStore(s => s.accessToken)

  // ── Skin data ────────────────────────────────────────────────────────────────
  const [skins,       setSkins]       = useState<SkinDef[]>([])
  const [activeSkinId,setActiveSkinId]= useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [saving,      setSaving]      = useState(false)

  const activeSkin = skins.find(s => s.id === activeSkinId) ?? null

  // ── Selected action ──────────────────────────────────────────────────────────
  const [selectedAction, setSelectedAction] = useState<ActionName>('idle')

  const actionDef: ActionDef = activeSkin?.actions?.[selectedAction] ?? { fps: 12, frames: [] }

  // ── Editing frame index (null = composing a new frame) ───────────────────────
  const [editingFrameIdx, setEditingFrameIdx] = useState<number | null>(null)

  // ── Layer composer state ─────────────────────────────────────────────────────
  const [layers,      setLayers]      = useState<Layer[]>([])
  const [dragIdx,     setDragIdx]     = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [flatteningCanvas, setFlatteningCanvas] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Animation preview state ───────────────────────────────────────────────────
  const [fps,         setFps]         = useState(12)
  const [previewing,  setPreviewing]  = useState(false)
  const [previewIdx,  setPreviewIdx]  = useState(0)
  const previewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load skins for this character ────────────────────────────────────────────
  useEffect(() => {
    if (!characterId) return
    setLoading(true)
    fetch(`${API}/admin/skins/character/${characterId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((data: SkinDef[]) => {
        setSkins(data)
        setActiveSkinId(data[0]?.id ?? null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [characterId, token])

  // Sync fps from action def when switching actions; also clear editing state
  useEffect(() => {
    setFps(actionDef.fps)
    setPreviewIdx(0)
    setEditingFrameIdx(null)
    stopPreview()
  }, [selectedAction, activeSkinId])

  // ── Canvas: re-render when layers change ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    for (const layer of layers) {
      if (!layer.visible) continue
      if (layer.img.complete && layer.img.naturalWidth > 0) {
        ctx.drawImage(layer.img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
      }
    }
  }, [layers])

  // ── Preview timer ────────────────────────────────────────────────────────────
  const stopPreview = useCallback(() => {
    if (previewTimerRef.current) clearInterval(previewTimerRef.current)
    previewTimerRef.current = null
    setPreviewing(false)
    setPreviewIdx(0)
  }, [])

  const startPreview = useCallback((frames: string[], fps: number) => {
    if (frames.length === 0) return
    stopPreview()
    let idx = 0
    setPreviewing(true)
    previewTimerRef.current = setInterval(() => {
      idx = (idx + 1) % frames.length
      setPreviewIdx(idx)
    }, Math.round(1000 / fps))
  }, [stopPreview])

  useEffect(() => () => stopPreview(), [stopPreview])

  // ── Layer helpers ─────────────────────────────────────────────────────────────

  // Upload a layer PNG to the server immediately on add, so we can persist metadata later.
  const addLayerFromFile = useCallback((file: File) => {
    const localSrc = URL.createObjectURL(file)
    const id = crypto.randomUUID()
    const img = new Image()
    img.onload = () => {
      setLayers(prev => [...prev, {
        id, name: file.name, src: localSrc, serverUrl: '', uploading: true, visible: true, img,
      }])
    }
    img.src = localSrc

    // Upload in background — store serverUrl when done
    const fd = new FormData()
    fd.append('file', file)
    fetch(`${API}/admin/skins/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ url }: { url: string }) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, serverUrl: url, uploading: false } : l))
      })
      .catch(() => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, uploading: false } : l))
      })
  }, [token])

  const handleLayerFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(addLayerFromFile)
    e.target.value = ''
  }

  const removeLayer = (id: string) => {
    setLayers(prev => {
      const layer = prev.find(l => l.id === id)
      if (layer?.src.startsWith('blob:')) URL.revokeObjectURL(layer.src)
      return prev.filter(l => l.id !== id)
    })
  }

  // Load a frame's original layer stack for editing.
  // If layer metadata exists, restores individual layers; otherwise falls back to flattened PNG.
  const loadFrameForEdit = useCallback((frameIdx: number, url: string, frameLayers?: LayerMeta[]) => {
    setLayers(prev => {
      prev.forEach(l => { if (l.src.startsWith('blob:')) URL.revokeObjectURL(l.src) })
      return []
    })
    setEditingFrameIdx(frameIdx)

    const metas = frameLayers && frameLayers.length > 0
      ? frameLayers
      : [{ url, name: `кадр ${frameIdx + 1}`, visible: true }]

    const result: Layer[] = new Array(metas.length)
    let done = 0
    metas.forEach((meta, i) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        result[i] = {
          id:        crypto.randomUUID(),
          name:      meta.name,
          src:       meta.url,
          serverUrl: meta.url,
          uploading: false,
          visible:   meta.visible,
          img,
        }
        if (++done === metas.length) setLayers([...result])
      }
      img.onerror = () => { if (++done === metas.length) setLayers([...result].filter(Boolean)) }
      img.src = meta.url
    })
  }, [])

  const toggleLayerVisibility = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l))
  }

  // ── Drag-and-drop layer reorder ──────────────────────────────────────────────

  const onDragStart = (idx: number) => setDragIdx(idx)
  const onDragOver  = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx) }
  const onDragEnd   = () => { setDragIdx(null); setDragOverIdx(null) }

  const onDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === targetIdx) { onDragEnd(); return }
    setLayers(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx, 1)
      next.splice(targetIdx, 0, moved)
      return next
    })
    onDragEnd()
  }

  // ── Flatten & save frame ─────────────────────────────────────────────────────

  const saveFrame = useCallback(async () => {
    if (!activeSkin) return
    setFlatteningCanvas(true)

    try {
      // Render to offscreen 1254×1254 canvas
      const off = document.createElement('canvas')
      off.width  = CANVAS_SIZE
      off.height = CANVAS_SIZE
      const ctx  = off.getContext('2d')!
      for (const layer of layers) {
        if (layer.visible && layer.img.complete && layer.img.naturalWidth > 0) {
          ctx.drawImage(layer.img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
        }
      }

      const blob = await new Promise<Blob>((res, rej) =>
        off.toBlob(b => b ? res(b) : rej(new Error('Canvas is empty')), 'image/png')
      )

      // Upload
      const fd = new FormData()
      fd.append('file', blob, `${activeSkin.id}_${selectedAction}_frame.png`)
      const upRes  = await fetch(`${API}/admin/skins/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!upRes.ok) throw new Error('Upload failed')
      const { url } = await upRes.json()

      // Build layer metadata from the current layer stack
      const layerMetas: LayerMeta[] = layers
        .filter(l => l.serverUrl)
        .map(l => ({ url: l.serverUrl, name: l.name, visible: l.visible }))

      // Replace the frame being edited, or append a new one
      let newFrames: string[]
      let newLayersMeta: LayerMeta[][]
      const existingLayers = actionDef.layers ?? actionDef.frames.map(() => [])
      if (editingFrameIdx !== null) {
        newFrames = [...actionDef.frames]
        newFrames[editingFrameIdx] = url
        newLayersMeta = [...existingLayers]
        newLayersMeta[editingFrameIdx] = layerMetas
        setEditingFrameIdx(null)
      } else {
        newFrames = [...actionDef.frames, url]
        newLayersMeta = [...existingLayers, layerMetas]
      }
      await saveAction(newFrames, fps, newLayersMeta)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка при сохранении кадра')
    } finally {
      setFlatteningCanvas(false)
    }
  }, [activeSkin, layers, selectedAction, actionDef, editingFrameIdx, fps, token])

  // ── Save action (frames + fps) to backend ────────────────────────────────────

  const saveAction = useCallback(async (frames: string[], fpsVal: number, layersMeta?: LayerMeta[][]) => {
    if (!activeSkin) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/admin/skins/${activeSkin.id}/action`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ action: selectedAction, fps: fpsVal, frames, layers: layersMeta }),
      })
      if (!res.ok) throw new Error('Save failed')
      const updated: SkinDef = await res.json()
      setSkins(prev => prev.map(s => s.id === updated.id ? updated : s))
    } finally {
      setSaving(false)
    }
  }, [activeSkin, selectedAction, token])

  const deleteFrame = async (frameIdx: number) => {
    const newFrames = actionDef.frames.filter((_, i) => i !== frameIdx)
    const newLayers = (actionDef.layers ?? []).filter((_, i) => i !== frameIdx)
    await saveAction(newFrames, fps, newLayers)
    if (previewing) stopPreview()
  }

  const handleFpsChange = async (newFps: number) => {
    setFps(newFps)
    if (actionDef.frames.length > 0) await saveAction(actionDef.frames, newFps)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return <div className={styles.center}>Загрузка...</div>
  if (error)   return <div className={styles.centerErr}>{error}</div>

  const previewSrc = previewing
    ? actionDef.frames[previewIdx]
    : actionDef.frames[0] ?? ''

  return (
    <div className={styles.root}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/admin/characters" className={styles.back}>← Персонажи</Link>
          <h1 className={styles.title}>
            🎬 {characterId}
            {activeSkin && <span className={styles.skinBadge}>{activeSkin.name}</span>}
          </h1>
        </div>

        {/* Skin selector (if multiple) */}
        {skins.length > 1 && (
          <select
            className="input"
            value={activeSkinId ?? ''}
            onChange={e => setActiveSkinId(e.target.value)}
            style={{ width: 200, fontSize: 13 }}
          >
            {skins.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        {saving && <span className={styles.saving}>Сохранение...</span>}
      </header>

      <div className={styles.body}>
        {/* ── Sidebar: action list ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Действия</div>
          {ACTIONS.map(action => {
            const def  = activeSkin?.actions?.[action]
            const count = def?.frames?.length ?? 0
            return (
              <button
                key={action}
                className={`${styles.actionBtn} ${selectedAction === action ? styles.actionBtnActive : ''}`}
                onClick={() => setSelectedAction(action)}
              >
                <span className={styles.actionLabel}>{ACTION_LABELS[action]}</span>
                <span className={`${styles.actionCount} ${count > 0 ? styles.actionCountFilled : ''}`}>
                  {count > 0 ? `${count} кадр${count === 1 ? '' : 'а'}` : 'пусто'}
                </span>
              </button>
            )
          })}
        </aside>

        {/* ── Main: editor ── */}
        <main className={styles.main}>
          <div className={styles.actionHeader}>
            <h2 className={styles.actionTitle}>{ACTION_LABELS[selectedAction]}</h2>
          </div>

          {/* Frame strip + FPS + preview */}
          <div className={styles.frameSection}>
            <div className={styles.frameStrip}>
              {actionDef.frames.map((url, i) => (
                <div
                  key={url + i}
                  className={`${styles.frameTile} ${
                    editingFrameIdx === i
                      ? styles.frameTileEditing
                      : previewing && previewIdx === i
                      ? styles.frameTileActive
                      : ''
                  }`}
                  onClick={() => loadFrameForEdit(i, url, actionDef.layers?.[i])}
                  title="Открыть кадр для редактирования"
                >
                  <img src={url} alt={`frame ${i + 1}`} className={styles.frameTileImg} />
                  <div className={styles.frameTileNum}>{i + 1}</div>
                  <button
                    className={styles.frameTileDel}
                    onClick={e => { e.stopPropagation(); deleteFrame(i) }}
                    title="Удалить кадр"
                  >×</button>
                </div>
              ))}
              {actionDef.frames.length < 10 && (
                <div className={styles.frameTilePlus}>
                  +{10 - actionDef.frames.length} слотов
                </div>
              )}
            </div>

            <div className={styles.fpsRow}>
              <label className={styles.fpsLabel}>
                FPS: <strong>{fps}</strong>
              </label>
              <input
                type="range"
                min={1} max={30}
                value={fps}
                onChange={e => handleFpsChange(Number(e.target.value))}
                className={styles.fpsSlider}
              />
              {actionDef.frames.length > 0 && (
                <button
                  className={`btn ${previewing ? 'btn-danger' : 'btn-primary'}`}
                  style={{ fontSize: 13 }}
                  onClick={() => previewing
                    ? stopPreview()
                    : startPreview(actionDef.frames, fps)
                  }
                >
                  {previewing ? '⏹ Стоп' : '▶ Превью'}
                </button>
              )}
              {previewing && previewSrc && (
                <img src={previewSrc} alt="preview" className={styles.previewImg} />
              )}
            </div>
          </div>

          {/* Layer composer */}
          <div className={styles.composer}>
            {/* Canvas */}
            <div className={styles.canvasWrap}>
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className={styles.canvas}
              />
              <div className={styles.canvasLabel}>{CANVAS_SIZE}×{CANVAS_SIZE} px</div>
            </div>

            {/* Layer panel */}
            <div className={styles.layerPanel}>
              <div className={styles.layerPanelHeader}>
                <span className={styles.layerPanelTitle}>Слои</span>
                <span className={styles.layerPanelHint}>снизу → вверх</span>
              </div>

              {/* Layer list (reversed: top of list = top of stack) */}
              <div className={styles.layerList}>
                {[...layers].reverse().map((layer, revIdx) => {
                  const realIdx = layers.length - 1 - revIdx
                  const isDragOver = dragOverIdx === realIdx
                  return (
                    <div
                      key={layer.id}
                      className={`${styles.layerItem} ${isDragOver ? styles.layerItemOver : ''}`}
                      draggable
                      onDragStart={() => onDragStart(realIdx)}
                      onDragOver={e => onDragOver(e, realIdx)}
                      onDrop={e => onDrop(e, realIdx)}
                      onDragEnd={onDragEnd}
                    >
                      <span className={styles.layerDrag} title="Перетащить">⠿</span>
                      <img src={layer.src} alt="" className={styles.layerThumb} />
                      <span className={styles.layerName} title={layer.name}>
                        {layer.uploading ? <span className={styles.layerUploading}>⏳</span> : null}
                        {layer.name}
                      </span>
                      <button
                        className={styles.layerVis}
                        onClick={() => toggleLayerVisibility(layer.id)}
                        title={layer.visible ? 'Скрыть' : 'Показать'}
                      >
                        {layer.visible ? '👁' : '🙈'}
                      </button>
                      <button
                        className={styles.layerDel}
                        onClick={() => removeLayer(layer.id)}
                        title="Удалить слой"
                      >×</button>
                    </div>
                  )
                })}
                {layers.length === 0 && (
                  <div className={styles.layerEmpty}>Добавьте слои →</div>
                )}
              </div>

              <div className={styles.layerActions}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleLayerFiles}
                />
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 13, flex: 1 }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  📁 Добавить слой
                </button>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 13, flex: 1 }}
                  disabled={
                    layers.length === 0 ||
                    flatteningCanvas ||
                    layers.some(l => l.uploading) ||
                    (editingFrameIdx === null && actionDef.frames.length >= 10)
                  }
                  onClick={saveFrame}
                >
                  {flatteningCanvas
                    ? 'Сохранение...'
                    : layers.some(l => l.uploading)
                    ? '⏳ Загрузка...'
                    : editingFrameIdx !== null
                    ? `✏️ Заменить кадр ${editingFrameIdx + 1}`
                    : '💾 Сохранить кадр'}
                </button>
                {editingFrameIdx !== null && (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12 }}
                    onClick={() => { setEditingFrameIdx(null); setLayers([]) }}
                    title="Отменить редактирование"
                  >✕</button>
                )}
              </div>
              {actionDef.frames.length >= 10 && (
                <div className={styles.maxFrames}>Максимум 10 кадров достигнут</div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
