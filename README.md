# Pallet Optimizer (Optymalizator Palet)

PWA aplikacja do optymalizacji wyboru palet transportowych na podstawie wymiarów i wagi mebli.

**Wersja TOD: 2026 KR** - Rohlig SUUS

## 🚀 Uruchomienie lokalne

```bash
# Instalacja zależności
npm install

# Uruchomienie w trybie deweloperskim
npm run dev

# Aplikacja dostępna pod http://localhost:3000
```

## 🧪 Testy

```bash
# Testy jednostkowe (Vitest)
npm run test        # tryb watch
npm run test:run    # jednorazowe uruchomienie

# Testy E2E (Playwright)
npm run e2e         # uruchom testy
npm run e2e:ui      # tryb UI
```

## 📦 Build produkcyjny

```bash
npm run build
npm run start
```



## 💰 Obliczenia cen (TOD 2026 KR)

### Definicje podstaw procentowych

Zgodnie z TOD, aplikacja rozróżnia:

- **freightNet** - stawka bazowa z cennika (min. 40 zł netto)
- **fuelNet** - korekta paliwowa (% od freightNet)
- **roadNet** - opłata drogowa (% od freightNet)
- **transportRateNet** = freightNet + fuelNet + roadNet (stawka transportowa)
- **seasonalNet** - dodatek sezonowy (domyślnie 6.5% od freightNet)

### Skąd brać % dopłat?

⚠️ **WAŻNE**: Wartości procentowe dla korekty paliwowej i opłaty drogowej są publikowane na [www.suus.com](https://www.suus.com) i zmieniają się okresowo.

Użytkownik wpisuje aktualne wartości w panelu "Dopłaty % (TOD 2026 KR)".
Ustawienia są zapisywane w localStorage przeglądarki.

### Wdrożone opłaty TOD

| Opłata | Typ | Domyślnie | Opis |
|--------|-----|-----------|------|
| Korekta paliwowa | % od frachtu | 20.02% | Konfigurowalna |
| Opłata drogowa | % od frachtu | 14.43% | Konfigurowalna |
| Dodatek sezonowy | % od frachtu | 6.5% | Włączony, można wyłączyć |
| Ponowna dostawa | 140% × attempts | Wyłączona | 40% + 100% za każdą próbę |
| Ponowny odbiór | 140% × attempts | Wyłączona | 40% + 100% za każdą próbę |
| Wniesienie/Zniesienie | Wg progów wagowych | Wyłączona | Tabela stawek + dopłata 60zł |

### Wniesienie/Zniesienie - progi wagowe (netto)

| Waga | Stawka |
|------|--------|
| ≤45 kg | 35 zł |
| ≤60 kg | 42 zł |
| ≤75 kg | 49 zł |
| ≤90 kg | 57 zł |
| 91-240 kg | 0.60 zł/kg (min 57 zł) |
| 241-800 kg | 0.50 zł/kg (min 144 zł) |
| >800 kg | ❌ Poza zakresem |

**Dopłata 60 zł** gdy:
- Waga elementu 100-168 kg, LUB
- Suma wymiarów (L+W+H) > 400 cm

## ⚙️ Konfiguracja

### Dodawanie nowej palety

1. Dodaj wpis do `src/config/pallet_types.json`:
```json
{
  "id": "NOWA_PALETA_100x50",
  "displayName": "Nowa Paleta 100×50",
  "lengthM": 1.0,
  "widthM": 0.5,
  "maxHeightCm": 220,
  "maxWeightKg": 200,
  "category": "STANDARD"
}
```

### Dodawanie nowej dopłaty TOD

1. Dodaj definicję w `src/config/tod_kr_2026.json`:
```json
{
  "id": "nowa_oplata",
  "label": "Nowa opłata",
  "category": "CUSTOM",
  "type": "FLAT",
  "value": 25,
  "defaultEnabled": false,
  "notes": "Opis nowej opłaty"
}
```

2. Obsłuż nowy typ w `src/domain/pricing.ts`

### Zmiana podstawy procentowej dla ponownej dostawy/odbioru

W pliku `src/domain/pricing.ts`, zmień w `DEFAULT_TOD_CONFIG`:

```typescript
// Zmiana z TRANSPORT_RATE na FREIGHT:
redeliveryPercentBase: 'FREIGHT',
repickupPercentBase: 'FREIGHT',
```


## 📋 Limity i reguły

| Tryb | Maks. wysokość | Maks. waga |
|------|----------------|------------|
| Standard | 220 cm | 1500 kg |

## 🔧 Technologie

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- react-hook-form + zod
- decimal.js (precyzyjne obliczenia finansowe)
- Vitest + Playwright

## ⚠️ Założenia

Następujące elementy zostały zaimplementowane z założeniami (brak jednoznacznej definicji w TOD):

1. **Podstawa dodatku sezonowego** - przyjęto % od freightNet (nie od transportRateNet)
2. **Podstawa ponownej dostawy/odbioru** - przyjęto transportRateNet jako "wynagrodzenie" z TOD, konfigurowalne w kodzie
3. **Walidacja wymiarów dla wniesienia** - używane wymiary po uwzględnieniu zapasu pakowania



## 🔗 Przydatne linki

- [Rohlig SUUS - aktualne dopłaty](https://www.suus.com)
- [Dokumentacja TOD](https://www.suus.com/cargo-indywidualne)
