# DVS Gestionale — Changelog

## 4.4 Experimental Build 4 — 14 luglio 2026

- Scadenze Avid spostate nel relativo riquadro.
- Scadenze Plugin visibili nel relativo riquadro.
- Bordo Sala come indicatore generale di criticità.
- Riquadri Avid e Plugin gialli o rossi con pulsazione lenta.
- Pulse anche per Avid e Plugin non assegnati.
- System ID Avid visibile nella Sintesi e nei Non assegnati.
- Seriale Plugin visibile nella Sintesi e nei Non assegnati.
- Ordinamento Licenze: Assegnati / Non assegnati, Avid prima dei Plugin.
- Rimossa la scritta REC dall'icona Hardware.
- Rimosso il pulsante + da Settings.
- Intestazione Sala cliccabile con Produzione, Aggiungi postazione e Chiudi.
- Produzione spostata in alto a destra della Sala.
- Aggiunta voce Non assegnato nel selettore Plugin.
- Nuova pagina Informazioni con versione, statistiche, changelog e crediti.

### Correzioni Build 2
- Scadenza Avid allineata a destra.
- Pulse sul bordo con colore coerente.
- System ID e seriali su due righe.
- REC centrato.
- Produzione salva e chiude.
- Produzione eliminabile.
- Postazione aggiuntiva eliminabile.
- Testata Sala interamente cliccabile e neutra.


### Correzioni Build 3
- Ripristinata la posizione precedente della scadenza Avid.
- Pulse applicato all'intero riquadro, con giallo o rosso coerente.
- Pallino Hardware riallineato nel menu laterale.
- Produzione nuovamente gestita con pulsanti RAI / PRIVATO / ALTRO.
- Aggiunto pulsante Elimina produzione.
- Aggiunta migrazione SQL per consentire una Sala senza produzione.


### Nuove funzioni Build 4
- Centro Stampa ed esportazione.
- Stampa Sale, Computer, Hardware, Licenze e archivio completo.
- Pulsanti Stampa e Salva come PDF.
- Header e footer automatici con logo, versione, data, copyright e crediti.
- Backup completo in un unico file JSON.
- Importazione backup con avviso preventivo.
- Ultimo backup con nome file, data e ora.
- Header dinamico e compatto durante lo scroll.
- Pulse più evidente sulle criticità.


### Hotfix Build 4.1
- Corretto il componente delle opzioni nel Centro Stampa.
- Rimosso definitivamente il pulsante Stampa dalla Sintesi.


## Build 5 — Rifinitura della Sintesi

- Configurazione Server disponibile per tutte le Sale.
- Configurazione Server visibile sulla stessa riga del nome Sala.
- Accesso diretto all'editor toccando la configurazione.
- Produzioni evidenziate: RAI blu, Privato rosa, Altro grigio.
- Scadenze della Sintesi sempre espresse in giorni residui.
- Pulse giallo e rosso reso più evidente.


## Build 6 — Gestione Asset
- Filtro Storico per Computer, Hardware e Licenze.
- Dismissione definitiva con motivo, data e nota.
- Asset storici di sola consultazione e mai assegnabili.
- Numerazione automatica Computer e Hardware.
- MAC 17 escluso permanentemente.
- Numerazione Avid: Ultimate 01–19, Singolo 20–39.
- Riutilizzo del primo numero libero appartenente allo Storico.
- Duplicati bloccati tra elementi operativi.


### Build 6.0.1 — Hotfix avvio
- Corretta la dichiarazione della funzione saveEditor che impediva l'avvio dell'app.
- Aggiornata la cache del Service Worker.
