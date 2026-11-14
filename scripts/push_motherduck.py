"""Upload the verified seed. Usage: python scripts/push_motherduck.py [--replace].

Requires MOTHERDUCK_TOKEN in the environment or .env.local. --replace deliberately
replaces an existing hosted database (including its simulated purchases).
"""
import argparse
import os
import pathlib
import re
import shutil
import tempfile

import duckdb
import check_db

ROOT = pathlib.Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--replace", action="store_true")
    args = parser.parse_args()
    env_file = ROOT / ".env.local"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            match = re.match(r"^\s*(MOTHERDUCK_TOKEN|KORI_MD_DATABASE)\s*=\s*(.*?)\s*$", line)
            if match:
                os.environ.setdefault(match[1], match[2].strip("\"'"))
    token = os.environ.get("MOTHERDUCK_TOKEN")
    if not token:
        raise SystemExit("Set MOTHERDUCK_TOKEN in .env.local first. Never put it in a shell argument.")
    os.environ["motherduck_token"] = token  # Used by the verification connection too.
    name = os.environ.get("KORI_MD_DATABASE", "kori")
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
        raise SystemExit("KORI_MD_DATABASE must be a simple SQL identifier.")
    if not check_db.main(ROOT / "db/kori.duckdb"):
        raise SystemExit("Local integrity checks failed; nothing uploaded.")
    con = duckdb.connect("md:", config={"motherduck_token": token})
    try:
        # A distinct local filename avoids a collision with the remote catalog name.
        with tempfile.TemporaryDirectory(prefix="kori-upload-") as directory:
            seed = pathlib.Path(directory) / "kori_upload_seed.duckdb"
            shutil.copyfile(ROOT / "db/kori.duckdb", seed)
            source = str(seed).replace("'", "''")
            verb = "create or replace database" if args.replace else "create database"
            con.execute(f'{verb} "{name}" from \'{source}\'')
        con.execute(f'use "{name}"')
        # Always install the current macros, whether copying the file included them or not.
        con.execute((ROOT / "sql/tools.sql").read_text())
        con.execute("insert into meta select 'simulation_revision', '0' where not exists (select 1 from meta where key='simulation_revision')")
        macros = con.execute("select count(*) from duckdb_functions() where database_name = ? and function_type='table_macro'", [name]).fetchone()[0]
        if macros < 6:
            raise RuntimeError("Hosted table macros are missing.")
    finally:
        con.close()
    if not check_db.main(f"md:{name}?attach_mode=single"):
        raise SystemExit("Hosted integrity checks failed.")
    print(f"Hosted database {name} is ready. Configure the same token and name in Vercel.")


if __name__ == "__main__":
    main()
