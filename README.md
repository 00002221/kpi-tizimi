# KPI tizimi: davomat, vazifalar, KPI va oylik

Ishxonalar uchun veb-ilova. Ishchi telefonida «Keldim» tugmasini bosadi. Tizim GPS orqali uning ishxona hududida ekanini tekshiradi, kerak bo'lsa selfi oladi, keyin vaqtida kelgani yoki kechikkanini belgilaydi. Oy oxirida davomat, vazifalar va rahbar bahosidan KPI chiqariladi, oylik esa jarimalar bilan birga avtomatik hisoblanadi.

- **Bir nechta kompaniya (SaaS):** har bir kompaniya alohida ro'yxatdan o'tadi va ma'lumotlari boshqalardan to'liq ajratilgan.
- **Tillar:** o'zbekcha, ruscha, inglizcha.
- **Backend:** Supabase (PostgreSQL, Auth, Storage). Barcha hisob-kitob server tomonidagi SQL funksiyalarida bajariladi. Shu sababli keyin yoziladigan mobil ilova ham aynan shu backend bilan ishlaydi.

```
kpi-tizimi/
├── supabase/schema.sql   ← butun baza: jadvallar, xavfsizlik (RLS), funksiyalar, Telegram
└── web/                  ← React (Vite) veb-ilova
```

---

## 1. Supabase'ni sozlash (taxminan 10 daqiqa)

1. [supabase.com](https://supabase.com) da yangi loyiha yarating. Region sifatida eng yaqinini tanlang, masalan **Frankfurt (eu-central-1)**.
2. **SQL Editor** → **New query** oching, `supabase/schema.sql` faylining to'liq matnini joylang va **Run** ni bosing.
   - Faylni qayta ishga tushirish xavfsiz, mavjud ma'lumotlar o'chmaydi.
   - Natijada `pg_net yoqilmadi` yoki `pg_cron sozlanmadi` degan xabar chiqsa: **Database → Extensions** bo'limida `pg_net` va `pg_cron` ni yoqing va faylni yana bir marta ishga tushiring. `pg_net` Telegram xabarlari uchun, `pg_cron` kunlik hisobot uchun kerak.
3. **Authentication → Sign In / Providers → Email** bo'limida:
   - Tez boshlash uchun **Confirm email** ni o'chiring. Supabase'ning bepul pochtasi soatiga bir necha xat bilan cheklangan.
   - Tasdiqlashni yoqiq qoldirmoqchi bo'lsangiz, **Authentication → Emails → SMTP** bo'limida o'z pochtangizni ulang.
4. **Authentication → URL Configuration → Site URL** maydoniga saytingiz manzilini yozing (5-bosqichdan keyin).
5. **Project Settings → API Keys** bo'limidan quyidagilarni nusxalang:
   - **Project URL**;
   - **anon** yoki **publishable** kalit.

## 2. Ilovani ishga tushirish

```bash
cd web
cp .env.example .env        # ichiga Project URL va anon kalitni yozing
npm install
npm run dev                 # http://localhost:5173
```

> GPS va kamera faqat **https** yoki `localhost` da ishlaydi. Telefonda sinash uchun avval saytni internetga joylang (3-bo'lim).

## 3. Internetga joylash (bepul)

**Vercel** (yoki Netlify):

1. Loyihani GitHub'ga yuklang.
2. Vercel'da **New Project** → repozitoriyni tanlang.
3. Sozlamalar:
   - **Root Directory:** `web`;
   - **Build Command:** `npm run build`;
   - **Output Directory:** `dist`.
4. **Environment Variables** bo'limiga `VITE_SUPABASE_URL` va `VITE_SUPABASE_ANON_KEY` ni qo'shing.
5. **Deploy** ni bosing. Olingan manzilni Supabase'dagi **Site URL** maydoniga yozing.

Ilova `#/` (hash) marshrutlardan foydalanadi, shuning uchun qo'shimcha redirect sozlamasi kerak emas. Telefonda brauzer menyusidan **«Bosh ekranga qo'shish»** ni tanlasangiz, ilova oddiy ilova kabi ochiladi (PWA).

## 4. Birinchi qadamlar (admin)

1. Saytda **«Kompaniyani ro'yxatdan o'tkazish»** ni tanlang. Siz admin bo'lasiz. Admin sifatida sizning davomatingiz sukut bo'yicha hisobga olinmaydi, kerak bo'lsa buni o'zgartirish mumkin.
2. **Sozlamalar** bo'limida:
   - **Ishxona joylashuvi:** xaritada bosing yoki ishxonada turib «Joriy joylashuvimni olish» tugmasini bosing. Radius uchun 100–200 m tavsiya etiladi.
   - **Ish jadvali:** boshlanish va tugash vaqti, kechiriladigan daqiqalar, tanaffus, ish kunlari.
   - **Jarimalar:** har bir kechikish uchun, kechikishning har daqiqasi uchun va erta ketishning har daqiqasi uchun.
   - **KPI ulushlari** (yig'indisi 100%) va oylikning KPI'ga bog'liq qismi.
   - **Telegram:** bot tokeni va chat ID. Qanday olish sahifadagi «Qanday ulash mumkin?» bo'limida yozilgan.
   - **Bayram kunlari.**
3. **Xodimlar** bo'limidagi taklif kodini yoki havolani ishchilarga yuboring.
4. Ishchi ro'yxatdan o'tgach, uni **tasdiqlang** va oyligini kiriting. Kerak bo'lsa, unga **shaxsiy jadval** bering.
5. Har oy **Vazifalar** va **Rahbar bahosi** bo'limlarini to'ldiring. **KPI va oylik** sahifasida natija tayyor bo'ladi va uni Excel'ga yuklab olish mumkin.

## 5. Qanday hisoblanadi

### Kelish

Server quyidagilarni tekshiradi:

- telefon joylashuvidan ishxonagacha bo'lgan masofani;
- joylashuv aniqligini (±300 m dan yomon bo'lsa rad etiladi);
- selfi rasmi haqiqatan yuklanganini.

Brauzerdagi qiymatlarni o'zgartirib aldab bo'lmaydi.

### Kechikish

Ishchi `ish boshlanishi + kechiriladigan daqiqalar` ichida kelsa, «vaqtida» hisoblanadi. Undan kech kelsa, «kechikdi» deb belgilanadi va daqiqalar **ish boshlanish vaqtidan** sanaladi. Masalan, ish 09:00 da boshlansa, 10 daqiqa kechiriladi va ishchi 09:17 da kelsa, 17 daqiqa kechikish yoziladi.

### Davomat foizi

| Kun | Hisoblanishi |
|---|---|
| Vaqtida kelgan | 100% |
| Kechikkan | Sozlamada belgilangan % (sukut bo'yicha 50%) |
| Kelmagan | 0% |
| Sababli (kasallik, ta'til; admin belgilaydi) | Hisobga olinmaydi |

### Vazifalar foizi

| Vazifa | Hisoblanishi |
|---|---|
| Muddatida bajarilgan | 100% |
| Kech bajarilgan | 50% |
| Bajarilmagan | 0% |

Har bir vazifa uning balliga qarab tortiladi.

### Rahbar bahosi

1–10 ballik baho → 10–100%.

### KPI

`KPI = davomat × ulush + vazifalar × ulush + baho × ulush`

Bu oy uchun ma'lumoti yo'q qism hisobga olinmaydi, qolgan ulushlar qayta taqsimlanadi.

### Oylik

`qat'iy qism + KPI qismi × KPI% − kelmagan kunlar − jarimalar`

Oy o'rtasida ishga kirgan xodimning oyligi ishlagan kunlariga mutanosib hisoblanadi.

### Telegram

- Kimdir kechiksa, darhol xabar keladi.
- Xohlasangiz, har bir kelish va ketish haqida ham xabar keladi.
- Belgilangan vaqtda «hali kelmaganlar» ro'yxati yuboriladi.

Xabarlar kompaniyaning asosiy tilida yuboriladi.

### Yuz tekshiruvi (ixtiyoriy)

Sozlamalar → **Kelishda selfi talab qilinsin** va **Yuzni namunaga solishtirish** yoqiladi.

- Har bir xodim bir marta, rozilik belgisini qo'yib, yuz namunasini beradi. Bu ro'yxatdan o'tgach yoki birinchi kirishda so'raladi.
- «Keldim» bosilganda selfi namuna bilan **telefonning o'zida** solishtiriladi (face-api, bepul). Natijada serverga faqat 128 ta raqamdan iborat "yuz izi" yuboriladi va masofani server hisoblaydi.
- Mos kelmasa, kelish baribir yoziladi, lekin **«Yuz mos emas»** deb belgilanadi va Telegram'ga ogohlantirish boradi.
- Admin «Davomat» bo'limida namuna va selfini yonma-yon ko'radi. «Xodimlar» bo'limidan namunani o'chirib, uni qayta oldirishi mumkin.
- Sezgirlik chegarasi `companies.face_threshold` ustunida (sukut bo'yicha 0.55). Qiymat kichikroq bo'lsa, tekshiruv qattiqroq bo'ladi.
- Yuz rasmi biometrik ma'lumot hisoblanadi, shuning uchun xodimlardan yozma rozilik oling.

## 6. Xavfsizlik

- Har bir jadvalda **Row Level Security** yoqilgan:
  - ishchi faqat o'z ma'lumotini ko'radi;
  - admin faqat o'z kompaniyasini ko'radi.
- Ishchi davomat jadvaliga to'g'ridan-to'g'ri yoza olmaydi, faqat `check_in` / `check_out` funksiyalari orqali yozadi.
- Selfi rasmlari yopiq bucket'da saqlanadi. Admin ularni 1 soat amal qiladigan havola orqali ko'radi.
- Telegram tokenini faqat admin ko'radi.
- Kompaniyada kamida bitta faol admin qolishi shart.
- **Cheklov:** maxsus «soxta GPS» ilovalari brauzerni aldashi mumkin. Selfi bu xavfni kamaytiradi. Haqiqiy mobil ilovada soxta joylashuvni aniqlash imkoniyati qo'shiladi.

## Bazani yangilash

Yangi versiya chiqqanda Supabase → **SQL Editor** da yangilangan `supabase/schema.sql` ni to'liq qayta ishga tushiring. Fayl mavjud ma'lumotlarni o'chirmaydi, faqat yangi ustun va funksiyalarni qo'shadi.

## 7. Mobil ilova uchun tayyor API

Keyingi bosqichda React Native yoki Flutter ilovasi yozilsa, u xuddi shu Supabase funksiyalarini chaqiradi.

| Funksiya | Vazifasi |
|---|---|
| `my_today()` | Bugungi jadval, ishxona joylashuvi, davomat holati |
| `check_in(lat, lng, accuracy, selfie_path, face)` | Kelishni belgilash (`face` — 128 ta raqam) |
| `my_face_status()`, `enroll_face(descriptor, photo, consent)` | Yuz namunasi |
| `check_out(lat, lng, accuracy)` | Ketishni belgilash |
| `set_task_status(task_id, status)` | Ishchi o'z vazifasi holatini o'zgartiradi |
| `attendance_grid(from, to)` | Kunlar bo'yicha holatlar |
| `daily_stats(from, to)` | Grafik uchun kunlik yig'indi |
| `month_matrix(month)` | Oylik matritsa |
| `month_report(month)` | Oylik KPI va maosh hisoboti |
| `check_join_code`, `join_company`, `create_company`, `regenerate_join_code` | Kompaniyaga qo'shilish va kod bilan ishlash |
| `telegram_test()` | Telegram sinov xabari |

## 8. Tekshirilgan

- SQL sxemasi PostgreSQL 16 da sinovdan o'tkazildi. U ikki marta ketma-ket ishga tushirildi va xatosiz ishladi.
- Quyidagi holatlar bo'yicha testlar yozildi:
  - masofa;
  - selfi;
  - qayta belgilash;
  - RLS (boshqa kompaniyani ko'rmaslik);
  - KPI va oylik formulasi (qo'lda hisoblangan natija bilan solishtirildi);
  - Telegram xabar matnlari;
  - oxirgi admin himoyasi.
- Veb-ilova PostgREST orqali haqiqiy baza bilan sinaldi:
  - ishchi kelishini belgilash;
  - admin xodimni tasdiqlashi;
  - vazifa yaratish;
  - baho qo'yish;
  - sababli kun belgilash;
  - sozlamalarni saqlash;
  - Excel eksport.
- Uchala tilda tarjima kalitlari to'liq: `npm run check-i18n`.
