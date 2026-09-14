# Goldman Sans font files

The UI is designed around **Goldman Sans**, Goldman Sachs' corporate typeface.
Goldman Sachs' own sites declare the font stack as
`Goldman Sans, Helvetica, Arial, sans-serif`, which is exactly what this project
uses. Goldman Sans is not on a public CDN, so the binaries are not committed
here.

To use the real typeface:

1. Obtain Goldman Sans and place these files in this folder:
   ```
   GoldmanSans-Regular.woff2
   GoldmanSans-Medium.woff2
   GoldmanSans-Bold.woff2
   ```
2. Uncomment the `@font-face` block at the top of `app/globals.css`.

Until then the stack falls back to `"Helvetica Neue", Helvetica, Arial`, which is
Goldman Sachs' own documented fallback and renders near-identically on macOS and
iOS.
