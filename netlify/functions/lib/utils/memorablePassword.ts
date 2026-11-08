import { randomInt } from "node:crypto";

// Four independent words and six digits give roughly 48 bits of entropy.
// This is an initial credential, never a reusable institutional password.
const WORDS = `
  taman kebun rumah pasar kota desa hutan pantai lembah bukit sungai danau sawah ladang lorong halaman
  buku meja kursi pintu jendela lampu pena kertas tas gelas piring sendok payung sepatu kain bantal
  bunga daun akar batang pohon padi kelapa mangga jeruk jambu pisang tebu kopi teh kapas bambu
  hujan awan angin embun kabut langit bulan bintang senja fajar pagi siang malam surya cahaya pelangi
  sabar tenang cerah jernih kuat rapi ramah jujur lincah hangat damai lembut luhur teguh cermat ringan
  baca tulis jalan lihat dengar hitung simpan susun rawat tanam petik pilih angkat buka tutup jawab
  kucing kelinci burung ikan semut lebah rusa kijang ayam bebek merpati elang camar katak tupai domba
  air api tanah batu pasir garam gula madu roti nasi susu minyak benang warna suara waktu
`.trim().split(/\s+/);

export function generateMemorableTemporaryPassword(): string {
  const words = Array.from({ length: 4 }, () => {
    const word = WORDS[randomInt(0, WORDS.length)];
    return `${word[0].toUpperCase()}${word.slice(1)}`;
  });
  return `${words.join("")}${randomInt(0, 1_000_000).toString().padStart(6, "0")}`;
}

export const memorablePasswordWordCount = WORDS.length;

/** A public submitter must never receive credentials for a pre-existing identity. */
export function canIssueImmediatePassword(hasExistingUser: boolean, hasExistingProfile: boolean): boolean {
  return !hasExistingUser && !hasExistingProfile;
}
