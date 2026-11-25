# 7 Wonders Score

Web-app για καταγραφή σκορ στο 7 Wonders: επιλογή παικτών, expansions, τυχαία σειρά καθίσματος + θαύματα,
εισαγωγή πόντων, ιστορικό, στατιστικά και χρονόμετρο γύρου. Καθαρό HTML/CSS/JS (χωρίς build step), οπότε
ανεβαίνει όπως είναι στο GitHub Pages. Τα δεδομένα αποθηκεύονται στο Firebase Firestore.

## Τι περιέχει

| Tab / οθόνη | Τι κάνει |
|---|---|
| **History** | Λίστα παιχνιδιών (ημερομηνία, παίκτες, νικητής, πόντοι). Πάτημα σε παιχνίδι → πόντοι ανά παίκτη/κατηγορία, **Edit scores**, **Delete**. |
| **New Game** | 1. Παίκτες (επιλογή / προσθήκη / διαγραφή) → 2. Expansions (Leaders, Cities, Wonders Pack – το τελευταίο ενεργό by default) → 3. Randomizer → 4. Πόντοι → αποτελέσματα. |
| **Randomizer** | Τυχαία σειρά (clockwise) με *δεξιά/αριστερά γείτονα* για τον καθένα, τυχαίο θαύμα + πλευρά (Day/Night). Το pool των θαυμάτων εξαρτάται από τα expansions (βλ. παρακάτω) και μπορείς να βγάλεις/βάλεις θαύματα. |
| **Players** | Διαχείριση παικτών, πρόσβαση στα στατιστικά τους. |
| **Stats** | Ανά παίκτη ή συνολικά: νίκες, win %, μέσος όρος, leaderboard, **κατανομή πόντων νικητών ανά κατηγορία**, εξέλιξη σκορ, απόδοση ανά θαύμα. |
| **Timer** | Αντίστροφη μέτρηση ανά γύρο, με διαφορετικό χρόνο για Age I/II/III, αυτόματη έναρξη επόμενου γύρου, ήχο/δόνηση, wake-lock. |

**Κατηγορίες πόντων:** Military, Coins (1 πόντος ανά 3 νομίσματα), Debts *(Cities)*, Civilian, Commercial, Guilds,
Wonder, Leaders *(Leaders)*, Cities *(Cities)*, Science (με calculator για σύμβολα). Ισοβαθμία → νικά όποιος έχει περισσότερα νομίσματα.

**Θαύματα ανά expansion:** Base: Alexandria, Babylon, Ephesos, Gizah, Halikarnassos, Olympia, Rhodos ·
Wonders Pack: Stonehenge, Abu Simbel, Great Wall, Manneken Pis · Leaders: Rome · Cities: Byzantium, Petra.
(Η λίστα είναι στο `js/data.js` αν θες να προσθέσεις κι άλλα.)

## Εκκίνηση τοπικά

Τα ES modules δεν δουλεύουν από `file://`, τρέξε έναν απλό server:

```bash
cd 7wonders-app
python3 -m http.server 5173
```

και άνοιξε <http://localhost:5173>. Όσο το `js/firebase-config.js` έχει τα placeholder, η εφαρμογή δουλεύει σε
**local mode** (δεδομένα μόνο στον browser, `localStorage`) — ιδανικό για δοκιμή.

## Ρύθμιση Firebase (Firestore + Google sign-in)

Η εφαρμογή ζητά σύνδεση με Google και μόνο οι λογαριασμοί που είναι στη λίστα του
[`firestore.rules`](firestore.rules) έχουν πρόσβαση (ο έλεγχος γίνεται στον server, όχι στον browser).

1. **Project:** <https://console.firebase.google.com> → *Create a project* (Analytics: off).
2. **Firestore:** *Build → Firestore Database → Create database* → *Standard edition*, location π.χ. `eur3`, *Production mode*.
3. **Authentication:** *Build → Authentication → Get started → Sign-in method → Google → Enable*, βάλε support email → Save.
4. **Authorized domains:** *Authentication → Settings → Authorized domains → Add domain* → `<username>.github.io`
   (το `localhost` υπάρχει ήδη).
5. **Web app:** *Project settings (⚙) → General → Your apps → Web (`</>`)* → register → αντίγραψε το `firebaseConfig`
   στο [`js/firebase-config.js`](js/firebase-config.js).
6. **Rules:** άνοιξε το `firestore.rules`, βάλε το Google email σου στη λίστα (πεζά) αντί για `YOUR_EMAIL@gmail.com`,
   και επικόλλησέ το στο *Firestore → Rules → Publish*.
7. Άνοιξε την εφαρμογή → *Sign in with Google*. Στο *History → ⚙ Settings* πρέπει να γράφει *Synced with Firebase* και το email σου.

**Πρόσθεση φίλου:** πρόσθεσε το Google email του στη λίστα του `isAllowed()` και ξανακάνε *Publish* στα Rules.
**Αφαίρεση:** σβήσε το email και *Publish*.

Αν έχεις ήδη δεδομένα από local mode: *Settings → Export JSON* πριν αλλάξεις config, και *Import JSON* αφού συνδεθείς.

> Το `apiKey` στο `firebase-config.js` είναι δημόσιο by design και δεν είναι μυστικό· την ασφάλεια την κάνουν το
> sign-in και τα Rules. Αν περιορίσεις το key σε HTTP referrers, συμπερίλαβε και `https://<project-id>.firebaseapp.com/*`,
> αλλιώς σπάει το sign-in.

## Deploy στο GitHub Pages

```bash
cd 7wonders-app
git init && git add . && git commit -m "7 Wonders score app"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

Μετά: repo → **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.
Η εφαρμογή θα είναι στο `https://<username>.github.io/<repo>/`. Χρησιμοποιεί hash-routing (`#/history`, …) και
σχετικά paths, άρα δουλεύει σε υποφάκελο χωρίς ρυθμίσεις. Σε iPhone: Safari → Share → **Add to Home Screen**.

## Δομή

```
index.html            shell + tab bar
css/styles.css        design tokens (φωτεινό/σκοτεινό θέμα)
js/app.js             router
js/data.js            κατηγορίες, expansions, θαύματα, κανόνες πόντων/κατάταξης
js/store.js           Firestore ή localStorage (ίδιο API)
js/firebase-config.js τα στοιχεία του Firebase project σου
js/draft.js           παιχνίδι σε εξέλιξη (αποθηκεύεται, δεν χάνεται σε refresh)
js/views/*.js         history, newgame (wizard), stats, players, timer
firestore.rules       κανόνες ασφαλείας Firestore
```

Δομή εγγράφου παιχνιδιού στο Firestore (`games/{id}`): `date`, `createdAt`, `expansions`, `players[]`
(`id`, `name`, `seat`, `wonder`, `side`, `scores{…}`, `total`), `winnerIds`, `winnerName`, `winnerScore`.
