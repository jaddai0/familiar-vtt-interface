import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('packager', ROOT / 'tools/package.py')
packager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packager)

class PackagingTests(unittest.TestCase):
    def test_clean_archive_and_reproducibility(self):
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder)
            archive = packager.build(out)
            original = archive.read_bytes()
            self.assertEqual(original, packager.build(out).read_bytes())
            with ZipFile(archive) as z:
                expected = {'familiar-vtt-interface/' + n for n in (*packager.FILES, 'module.json')}
                self.assertEqual(set(z.namelist()), expected)
                z.extractall(out / 'installed')
            installed = out / 'installed/familiar-vtt-interface'
            m = json.loads((installed / 'module.json').read_text())
            self.assertNotIn('download', m)
            for name in (*m['esmodules'], *m['styles'], 'scripts/preferences.mjs'):
                self.assertEqual((installed / name).read_bytes(), (ROOT / name).read_bytes())
            self.assertEqual((installed / 'module.json').read_bytes(), (out / 'module.json').read_bytes())

    def test_hosted_manifest_matches_zip(self):
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder)
            manifest = 'https://example.org/familiar/module.json'
            download = 'https://example.org/familiar/0.2.1.zip'
            archive = packager.build(out, manifest, download)
            with ZipFile(archive) as z:
                data = z.read('familiar-vtt-interface/module.json')
            self.assertEqual(data, (out / 'module.json').read_bytes())
            self.assertEqual(json.loads(data)['download'], download)
            self.assertEqual(json.loads(data)['manifest'], manifest)

    def test_reject_incomplete_or_credential_urls(self):
        with tempfile.TemporaryDirectory() as folder:
            for manifest, download in [('https://example.org/a', None), ('http://example.org/a', 'https://example.org/b'), ('https://secret@example.org/a', 'https://example.org/b')]:
                with self.assertRaises(ValueError):
                    packager.build(Path(folder), manifest, download)

if __name__ == '__main__':
    unittest.main()
