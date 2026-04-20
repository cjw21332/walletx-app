const { useState, useEffect } = React

const initialLocations = [
  { id: 1, name: 'Manila, Philippines', lat: 14.5995, lon: 120.9842 },
  { id: 2, name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { id: 3, name: 'London', lat: 51.5074, lon: -0.1278 },
  { id: 4, name: 'New York', lat: 40.7128, lon: -74.0060 },
  { id: 5, name: 'Dubai', lat: 25.2048, lon: 55.2708 }
]

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [locations, setLocations] = useState(initialLocations)
  const [selectedLocation, setSelectedLocation] = useState(initialLocations[0])
  const [weather, setWeather] = useState(null)
  const [daily, setDaily] = useState([])
  const [hourly, setHourly] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [manageSearch, setManageSearch] = useState('')

  useEffect(() => {
    requestLocationPermission()
  }, [])

  useEffect(() => {
    if (selectedLocation && selectedLocation.lat && selectedLocation.lon) {
      loadWeather(selectedLocation)
    }
  }, [selectedLocation])

  const requestLocationPermission = () => {
    if (!navigator.geolocation) {
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          name: 'Current Location'
        }
        setSelectedLocation(coords)
      },
      () => {
        // Geolocation denied or unavailable; continue using default Philippines location.
      }
    )
  }

  const loadWeather = async (location) => {
    setLoading(true)
    setError('')

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current_weather=true&hourly=temperature_2m,weathercode,relativehumidity_2m,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max&timezone=auto`
      const response = await fetch(url)
      const data = await response.json()
      const today = new Date(data.current_weather.time)
      setWeather({
        ...data.current_weather,
        location: location.name,
        updated: today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })

      const dailyForecast = data.daily.time.map((date, index) => ({
        date,
        max: data.daily.temperature_2m_max[index],
        min: data.daily.temperature_2m_min[index],
        code: data.daily.weathercode[index],
        rain: data.daily.precipitation_probability_max[index]
      }))
      setDaily(dailyForecast.slice(0, 7))

      const hourlyForecast = data.hourly.time.slice(0, 10).map((time, index) => ({
        time,
        temp: data.hourly.temperature_2m[index],
        code: data.hourly.weathercode[index]
      }))
      setHourly(hourlyForecast)
    } catch (err) {
      setError('Unable to load weather. Try again.')
    }

    setLoading(false)
  }

  const getWeatherIcon = (code) => {
    const icons = {
      0: '☀️',
      1: '🌤️',
      2: '⛅',
      3: '☁️',
      45: '🌫️',
      48: '🌫️',
      51: '🌦️',
      53: '🌦️',
      55: '🌦️',
      56: '🌨️',
      57: '🌨️',
      61: '🌧️',
      63: '🌧️',
      65: '🌧️',
      66: '🌨️',
      67: '🌨️',
      71: '❄️',
      73: '❄️',
      75: '❄️',
      77: '❄️',
      80: '🌧️',
      81: '🌧️',
      82: '🌧️',
      85: '❄️',
      86: '❄️',
      95: '⛈️',
      96: '⛈️',
      99: '⛈️'
    }
    return icons[code] || '❓'
  }

  const getWeatherLabel = (code) => {
    const labels = {
      0: 'Clear',
      1: 'Mainly Clear',
      2: 'Partly Cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Fog',
      51: 'Light Drizzle',
      53: 'Moderate Drizzle',
      55: 'Dense Drizzle',
      56: 'Freezing Drizzle',
      57: 'Freezing Drizzle',
      61: 'Light Rain',
      63: 'Rain',
      65: 'Heavy Rain',
      66: 'Freezing Rain',
      67: 'Freezing Rain',
      71: 'Snow',
      73: 'Snow',
      75: 'Heavy Snow',
      77: 'Snow Grains',
      80: 'Light Showers',
      81: 'Showers',
      82: 'Heavy Showers',
      85: 'Light Snow',
      86: 'Heavy Snow',
      95: 'Thunderstorm',
      96: 'Thunderstorm',
      99: 'Thunderstorm'
    }
    return labels[code] || 'Unknown'
  }

  const handleAddLocation = async () => {
    if (!manageSearch.trim()) return
    setLoading(true)
    setError('')

    try {
      const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(manageSearch)}&count=1`)
      const geoData = await geoResponse.json()
      if (geoData.results && geoData.results.length > 0) {
        const result = geoData.results[0]
        const newLocation = {
          id: Date.now(),
          name: result.name,
          lat: result.latitude,
          lon: result.longitude
        }
        setLocations((prev) => [newLocation, ...prev])
        setSelectedLocation(newLocation)
        setManageSearch('')
        setActiveTab('home')
      } else {
        setError('Could not add that city.')
      }
    } catch (err) {
      setError('Unable to add location. Try again.')
    }

    setLoading(false)
  }

  const handleLocationSelect = (location) => {
    setSelectedLocation(location)
    setActiveTab('home')
  }

  const tempFeels = weather ? `${Math.round(weather.temperature)}°` : '--'
  const currentIcon = weather ? getWeatherIcon(weather.weathercode) : '❓'
  const currentLabel = weather ? getWeatherLabel(weather.weathercode) : ''

  const renderOverview = () => (
    <>
      <header className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-300/75">Atmosphere</p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">Weather Overview</h1>
        </div>
        <button
          onClick={() => setActiveTab('locations')}
          className="inline-flex items-center gap-2 rounded-3xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
        >
          <span>Manage</span>
          <span className="text-sky-300">•</span>
        </button>
      </header>

      <div className="glass-card overflow-hidden rounded-[32px] border border-white/10 p-5 shadow-2xl shadow-slate-900/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-sky-200/70">Current Weather</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{selectedLocation.name}</h2>
            <p className="mt-1 text-sm text-slate-300">{weather ? currentLabel : 'Loading latest conditions...'}</p>
          </div>
          <div className="rounded-[28px] bg-slate-950/40 p-4 text-center shadow-inner shadow-slate-950/30">
            <p className="text-6xl leading-none">{currentIcon}</p>
            <p className="mt-2 text-sm uppercase tracking-[0.35em] text-slate-400">Now</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Temp" value={weather ? `${Math.round(weather.temperature)}°C` : '--'} />
          <StatCard label="Wind" value={weather ? `${Math.round(weather.windspeed)} km/h` : '--'} />
          <StatCard label="Humidity" value={weather ? `${Math.round((weather.temperature / 40) * 100)}%` : '--'} />
          <StatCard label="Updated" value={weather ? weather.updated : '--'} />
        </div>

        <div className="mt-6 rounded-[28px] border border-white/10 bg-slate-950/30 p-4">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Hourly forecast</span>
            <span>Full report</span>
          </div>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2 scroll-smooth">
            {hourly.map((hour, index) => (
              <div key={index} className="min-w-[88px] rounded-3xl border border-white/10 bg-slate-900/70 p-3 text-center">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{new Date(hour.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="my-2 text-2xl">{getWeatherIcon(hour.code)}</p>
                <p className="text-sm text-slate-200">{Math.round(hour.temp)}°</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )

  const renderLocations = () => (
    <div className="glass-card rounded-[32px] border border-white/10 p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-sky-300/70">Manage Locations</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Your saved destinations</h3>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex gap-3 flex-wrap">
          <input
            value={manageSearch}
            onChange={(e) => setManageSearch(e.target.value)}
            placeholder="Search for a city..."
            className="flex-1 min-w-[180px] rounded-3xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            onKeyDown={(e) => e.key === 'Enter' && handleAddLocation()}
          />
          <button onClick={handleAddLocation} className="rounded-3xl bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300">
            Add
          </button>
        </div>
        <div className="grid gap-4">
          {locations.map((location) => (
            <button
              key={location.id}
              onClick={() => handleLocationSelect(location)}
              className="group flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/70 p-4 text-left transition hover:border-sky-300/50"
            >
              <div>
                <p className="text-sm text-slate-400">{location.name}</p>
                <p className="mt-2 text-lg font-semibold text-white">{location.name === selectedLocation.name ? 'Current selection' : 'View details'}</p>
              </div>
              <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300 transition group-hover:bg-sky-500/20">Open</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const renderForecast = () => (
    <div className="glass-card rounded-[32px] border border-white/10 p-5">
      <div className="mb-5">
        <p className="text-sm uppercase tracking-[0.35em] text-sky-300/70">7-Day Forecast</p>
        <h3 className="mt-2 text-xl font-semibold text-white">{selectedLocation.name} outlook</h3>
      </div>
      <div className="grid gap-4">
        {daily.map((day) => (
          <div key={day.date} className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-inner shadow-slate-950/20">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">{new Date(day.date).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                <p className="mt-2 text-xl font-semibold text-white">{getWeatherLabel(day.code)}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl">{getWeatherIcon(day.code)}</p>
                <p className="mt-2 text-sm text-slate-300">{Math.round(day.min)}° / {Math.round(day.max)}°</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-xl px-4 pt-4">
        {error && (
          <div className="mb-5 rounded-3xl bg-rose-500/10 border border-rose-500/20 p-4 text-sm text-rose-100">
            {error}
          </div>
        )}

        {activeTab === 'home' && renderOverview()}
        {activeTab === 'locations' && renderLocations()}
        {activeTab === 'forecast' && renderForecast()}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-slate-950/80 px-4 py-4 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <NavButton label="Overview" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
          <NavButton label="Locations" active={activeTab === 'locations'} onClick={() => setActiveTab('locations')} />
          <NavButton label="Forecast" active={activeTab === 'forecast'} onClick={() => setActiveTab('forecast')} />
        </div>
      </nav>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
    </div>
  )
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full border px-4 py-3 text-sm font-semibold transition ${
        active ? 'border-sky-400 bg-slate-900/70 text-white' : 'border-white/10 bg-slate-950/70 text-slate-300 hover:border-slate-200/20'
      }`}
    >
      {label}
    </button>
  )
}

function NavButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-3xl px-4 py-3 text-sm font-semibold transition ${
        active ? 'bg-sky-400/15 text-sky-200' : 'text-slate-400 hover:text-slate-100'
      }`}
    >
      {label}
    </button>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<App />)
