# Reading form LINKS from the Drive folder

Your folder holds *links* to forms rather than the forms themselves. The builder
now follows all of these:

| What is in the folder | Works? |
| --- | --- |
| Drive **shortcut** to a Google Form (right-click > Add shortcut to Drive) | Yes - best option |
| The Google Form itself | Yes |
| The Form's **linked response Sheet** | Yes |
| A CSV export | Yes |
| A `.url` / `.webloc` file dragged from the browser | Yes |
| A `.txt` file with form links pasted in | Yes |
| A **Google Doc** with the links pasted or hyperlinked | Yes |
| A **Google Sheet** listing links, with a `Link` / `URL` / `Form` heading | Yes |
| A public **`/viewform`** link only | **No - see below** |

---

## The one link that cannot work

A public fill-in link looks like this:

```
https://docs.google.com/forms/d/e/1FAIpQLSd9xK.../viewform
```

That `1FAIpQLS...` code is **not** the form's file ID. It is a publish code, and
Google provides no way to turn it back into the real file. This is a limitation
in Google's own API, not something code can work around. Anyone with the link
can *submit*, but nobody can *read the responses* through it.

### The fix - use the edit link instead

An edit link has `/edit` and no `/e/`:

```
https://docs.google.com/forms/d/1a2B3c4D5e6F7g.../edit
```

To get it: open the form from your own Drive, then copy what is in the address
bar. That is the link to put in the folder.

### Even easier - use shortcuts

Instead of pasting text links at all:

1. Find the form in Drive.
2. Right-click it > **Organise** > **Add shortcut to Drive**.
3. Put the shortcut in the teacher's folder.

Shortcuts always resolve, never expire, and survive the form being renamed.

---

## Diagnosing a link that will not resolve

In the Apps Script editor, pick the function **`testEvalLinkDetection`** and
press **Run**. It prints one line per file, for example:

```
OK    PASTOR / G7 Lorenzo shortcut  ->  7 - LORENZO  (grade 7, JUNIOR HIGH SCHOOL, 12 responses)
OK    PASTOR / links doc [1]        ->  9 - PIO      (grade 9, JUNIOR HIGH SCHOOL, 15 responses)
SKIP  PASTOR / class photo.jpg      [image/jpeg]  not a readable type
EMPTY PASTOR / old form.url         resolved to nothing

Notes:
  - "old form.url" is a public fill-in form link, which cannot be opened for reading.
    Use the form's EDIT link (it contains /edit), a Drive shortcut to the form,
    or its linked response Sheet.
```

This tells you precisely which file is the problem and why, without building
anything.

---

## Two other things that cause "cannot detect"

**Sharing.** A link resolves only if the Google account running the script can
open the target. If a form belongs to another teacher's account, ask them to
share it with your account. The error will say *"links to a file this account
cannot open"*.

**Copied forms have no responses.** Duplicating a Google Form does **not**
duplicate its responses. Always link the original form, or its response Sheet.
