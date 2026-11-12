-- PromptPrinter — eigene API-Keys schreibt nur noch der Server
--
-- 0015 gab authenticated insert, update und delete auf die ganze Tabelle user_api_keys, 0030 zusätzlich update
-- (is_active). Die Route api/settings/api-key verlangt vor jedem Schreiben den zweiten Faktor (AAL2, wenn das Konto
-- einen hat) und testet einen neuen Key mit einem Aufruf beim Anbieter. Über die Data API liess sich beides umgehen:
-- mit einer Sitzung ohne zweiten Faktor base_url eines custom-Keys auf einen fremden Host setzen (der Chiffretext
-- bleibt gültig, der nächste Chat-Zug schickt den entschlüsselten Key dorthin), einen Key löschen oder umschalten.
--
-- Danach schreibt nur noch der Server: die Route mit dem Service-Role-Schlüssel und ausdrücklicher user_id,
-- umgeschaltet über set_active_byok_provider_for (0059). Lesen bleibt wie in 0020 und 0030 (Spaltenliste ohne
-- encrypted_key).
--
-- Reihenfolge: erst den Code ausliefern, der so schreibt, dann diese Migration. Der Code davor schreibt mit der
-- Sitzung und scheiterte ohne diese Rechte.
--
-- Rückgängig:
--   grant insert, update, delete on public.user_api_keys to authenticated;
--   und set_active_byok_provider aus 0030 und 0046 wieder anlegen.

revoke insert, update, delete on public.user_api_keys from authenticated;
-- Das Spaltenrecht aus 0030 nimmt das REVOKE auf die Tabelle schon mit; hier ausdrücklich, damit es auch beim Lesen
-- dieser Datei allein klar ist.
revoke update (is_active) on public.user_api_keys from authenticated;

-- Die Fassung aus 0030 lief mit der Sitzung des Aufrufers und brauchte genau diese Rechte. Ohne sie tut sie nichts mehr,
-- die Route ruft set_active_byok_provider_for.
drop function if exists public.set_active_byok_provider(text);
