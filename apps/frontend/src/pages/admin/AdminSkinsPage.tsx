import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAdminStore } from '../../stores/adminStore'
import styles from './AdminSkinsPage.module.css'

const API = import.meta.env.VITE_API_URL ?? '/api/v1'

interface SkinDef {
  id:          string
  characterId: string
  name:        string
  description: string | null
  rarity:      string
  price:       number
  inShop:      boolean
  imgIdle:     string
  imgAttack:   string
  imgHit:      string
  imgDeath:    string
  createdAt:   string
  _count:      { owners: number }
}

const RARITY_COLOR: Record<string, string> = {
  common:    '#9ca3af',
  rare:      '#60a5fa',
  epic:      '#c084fc',
  legendary: '#fbbf24',
}

const emptyForm = {
  id: '', characterId: '', name: '', description: '',
  rarity: 'common', price: 0, inShop: false,
  imgIdle: '', imgAttack: '', imgHit: '', imgDeath: '',
}

export default function AdminSkinsPage() {
  const token = useAdminStore(s => s.accessToken)

  const [skins,   setSkins]   = useState<SkinDef[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [form,    setForm]    = useState({ ...emptyForm })
  const [editing, setEditing] = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingFieldRef = useRef<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/admin/skins`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(await res.text())
      setSkins(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const uploadImage = async (file: File): Promise<string> => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API}/admin/skins/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    })
    if (!res.ok) throw new Error('Ошибка загрузки файла')
    const { url } = await res.json()
    return url
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const field = pendingFieldRef.current
    if (!file || !field) return

    setUploadingField(field)
    try {
      const url = await uploadImage(file)
      setForm(prev => ({ ...prev, [field]: url }))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setUploadingField(null)
      pendingFieldRef.current = null
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const triggerUpload = (field: string) => {
    pendingFieldRef.current = field
    fileInputRef.current?.click()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const url    = editing ? `${API}/admin/skins/${editing}` : `${API}/admin/skins`
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, price: Number(form.price) }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Ошибка')
      }
      setEditing(null)
      setShowForm(false)
      setForm({ ...emptyForm })
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (skin: SkinDef) => {
    setEditing(skin.id)
    setForm({
      id:          skin.id,
      characterId: skin.characterId,
      name:        skin.name,
      description: skin.description ?? '',
      rarity:      skin.rarity,
      price:       skin.price,
      inShop:      skin.inShop,
      imgIdle:     skin.imgIdle,
      imgAttack:   skin.imgAttack,
      imgHit:      skin.imgHit,
      imgDeath:    skin.imgDeath,
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelForm = () => {
    setEditing(null)
    setShowForm(false)
    setForm({ ...emptyForm })
  }

  const handleDelete = async (id: string) => {
    if (!confirm(`Удалить скин «${id}»? Это уберёт его у всех пользователей.`)) return
    await fetch(`${API}/admin/skins/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    load()
  }

  const toggleShop = async (skin: SkinDef) => {
    await fetch(`${API}/admin/skins/${skin.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ inShop: !skin.inShop }),
    })
    load()
  }

  const IMG_FIELDS: { key: keyof typeof emptyForm; label: string }[] = [
    { key: 'imgIdle',   label: 'Idle (стоит)' },
    { key: 'imgAttack', label: 'Attack (атака)' },
    { key: 'imgHit',    label: 'Hit (удар)' },
    { key: 'imgDeath',  label: 'Death (смерть)' },
  ]

  return (
    <div className={styles.root}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/admin" className={styles.back}>← Дашборд</Link>
          <h1 className={styles.title}>🎨 Скины</h1>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { cancelForm(); setShowForm(true) }}
        >
          + Новый скин
        </button>
      </header>

      {/* Create / Edit form */}
      {showForm && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>
            {editing ? `Редактировать: ${editing}` : 'Создать скин'}
          </h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>ID скина *</span>
                <input
                  className="input"
                  value={form.id}
                  onChange={e => setForm(p => ({ ...p, id: e.target.value }))}
                  placeholder="boxer_blue_gloves"
                  disabled={!!editing}
                  required
                />
                <span className={styles.hint}>snake_case, только латиница. Нельзя изменить после создания.</span>
              </label>
              <label className={styles.field}>
                <span>Персонаж *</span>
                <input
                  className="input"
                  value={form.characterId}
                  onChange={e => setForm(p => ({ ...p, characterId: e.target.value }))}
                  placeholder="boxer"
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Название *</span>
                <input
                  className="input"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Синие перчатки"
                  required
                />
              </label>
            </div>

            <div className={styles.row}>
              <label className={styles.field}>
                <span>Редкость</span>
                <select
                  className="input"
                  value={form.rarity}
                  onChange={e => setForm(p => ({ ...p, rarity: e.target.value }))}
                >
                  <option value="common">Common</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Legendary</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Цена (монеты)</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))}
                />
              </label>
              <label className={styles.fieldCheck}>
                <input
                  type="checkbox"
                  checked={form.inShop}
                  onChange={e => setForm(p => ({ ...p, inShop: e.target.checked }))}
                />
                <span>Показывать в магазине</span>
              </label>
            </div>

            <label className={styles.field} style={{ gridColumn: '1/-1' }}>
              <span>Описание</span>
              <input
                className="input"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Необязательное описание"
              />
            </label>

            {/* Image upload fields */}
            <div className={styles.imgGrid}>
              {IMG_FIELDS.map(({ key, label }) => (
                <div key={key} className={styles.imgField}>
                  <span className={styles.imgLabel}>{label}</span>
                  {form[key] ? (
                    <img
                      src={form[key] as string}
                      alt={label}
                      className={styles.imgPreview}
                    />
                  ) : (
                    <div className={styles.imgEmpty}>Нет изображения</div>
                  )}
                  <div className={styles.imgActions}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 12 }}
                      onClick={() => triggerUpload(key)}
                      disabled={uploadingField !== null}
                    >
                      {uploadingField === key ? 'Загрузка...' : '📁 Загрузить'}
                    </button>
                    <input
                      className="input"
                      style={{ fontSize: 12, flex: 1 }}
                      value={form[key] as string}
                      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder="или вставьте URL"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.formActions}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Сохранение...' : editing ? 'Сохранить' : 'Создать'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={cancelForm}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Skins list */}
      <div className={styles.content}>
        {loading && <div className={styles.loading}>Загрузка...</div>}
        {error   && <div className={styles.error}>{error}</div>}

        {!loading && skins.length === 0 && (
          <div className={styles.empty}>
            <div>🎨</div>
            <div>Нет скинов. Создайте первый!</div>
          </div>
        )}

        <div className={styles.grid}>
          {skins.map(skin => (
            <div key={skin.id} className={styles.card}>
              <div className={styles.cardImgs}>
                {[skin.imgIdle, skin.imgAttack, skin.imgHit, skin.imgDeath].map((src, i) => (
                  src ? (
                    <img key={i} src={src} alt="" className={styles.thumb} />
                  ) : (
                    <div key={i} className={styles.thumbEmpty}>?</div>
                  )
                ))}
              </div>

              <div className={styles.cardBody}>
                <div className={styles.cardName}>{skin.name}</div>
                <div className={styles.cardMeta}>
                  <span className={styles.cardId}>{skin.id}</span>
                  <span
                    className={styles.rarity}
                    style={{ color: RARITY_COLOR[skin.rarity] ?? '#9ca3af' }}
                  >
                    {skin.rarity}
                  </span>
                </div>
                <div className={styles.cardStats}>
                  <span>👤 {skin.characterId}</span>
                  <span>💰 {skin.price === 0 ? 'Бесплатно' : `${skin.price} монет`}</span>
                  <span>🛒 {skin._count.owners} куплено</span>
                </div>
              </div>

              <div className={styles.cardActions}>
                <button
                  className={`btn ${skin.inShop ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 12 }}
                  onClick={() => toggleShop(skin)}
                  title={skin.inShop ? 'Убрать из магазина' : 'Добавить в магазин'}
                >
                  {skin.inShop ? '🛒 В магазине' : '🚫 Скрыт'}
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={() => startEdit(skin)}
                >
                  ✏️
                </button>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: 12 }}
                  onClick={() => handleDelete(skin.id)}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
