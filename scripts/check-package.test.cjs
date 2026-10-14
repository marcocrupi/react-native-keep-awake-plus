const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");

const root = path.resolve(__dirname, "..");
const checker = path.join(__dirname, "check-package.cjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "keep-awake-package-"));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

// Capture real npm metadata; substitute only the subprocess response, and run
// the actual checker in a fresh process rather than copying its validation.
const valid = JSON.parse(
  execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
);
const producer = path.join(scratch, "npm.cjs");
const responseFile = path.join(scratch, "response.json");
const invocationFile = path.join(scratch, "invocation.json");
fs.writeFileSync(
  producer,
  "const fs = require('node:fs');\n" +
    "fs.writeFileSync(process.env.QA01_INVOCATION, JSON.stringify({args: process.argv.slice(2), cwd: process.cwd()}));\n" +
    "process.stdout.write(fs.readFileSync(process.env.QA01_RESPONSE, 'utf8'));\n" +
    "process.exit(Number(process.env.QA01_PRODUCER_EXIT));\n"
);

function witness(name, response, accepted = false, exitCode = 0) {
  test(name, () => {
    const payload =
      typeof response === "string" ? response : JSON.stringify(response);
    fs.writeFileSync(responseFile, payload);
    fs.rmSync(invocationFile, { force: true });
    const result = spawnSync(process.execPath, [checker], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        npm_execpath: producer,
        QA01_RESPONSE: responseFile,
        QA01_INVOCATION: invocationFile,
        QA01_PRODUCER_EXIT: String(exitCode),
      },
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.deepEqual(JSON.parse(fs.readFileSync(invocationFile, "utf8")), {
      args: ["pack", "--dry-run", "--json"],
      cwd: root,
    });
    if (process.env.QA01_EVIDENCE_DIR) {
      fs.mkdirSync(process.env.QA01_EVIDENCE_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(process.env.QA01_EVIDENCE_DIR, `${name}.json`),
        payload
      );
      fs.writeFileSync(
        path.join(process.env.QA01_EVIDENCE_DIR, `${name}.log`),
        `exit=${result.status}\n${result.stdout}${result.stderr}`
      );
    }
    if (accepted) {
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Validated 24 required npm package files\./);
    } else {
      assert.notEqual(result.status, 0, "Malformed response was accepted");
      assert.doesNotMatch(result.stdout, /Validated/);
    }
  });
}

function changePackage(edit) {
  const response = structuredClone(valid);
  edit(response[0]);
  return response;
}

function changeFile(edit) {
  return changePackage((packed) =>
    edit(packed.files.find((file) => file.path === "index.native.js"))
  );
}

// Independent review's three contractual RED witnesses.
witness("producer-arraylike-object", { 0: valid[0], length: 1 });
witness(
  "producer-boolean-size",
  changeFile((file) => {
    file.size = true;
  })
);
witness(
  "producer-string-size",
  changeFile((file) => {
    file.size = "1";
  })
);

witness("valid-package", valid, true);
witness("invalid-json", "{unexpected");
witness("subprocess-failed", valid, false, 7);
witness("empty-packages", []);
witness("two-packages", [...valid, ...valid]);

for (const [label, value] of [
  ["null", null],
  ["object", {}],
  ["string", "1"],
  ["number", 1],
  ["boolean", true],
]) {
  witness(`packages-${label}`, JSON.stringify(value));
  witness(`package-${label}`, [value]);
  witness(
    `files-${label}`,
    changePackage((packed) => {
      packed.files = value;
    })
  );
  witness(
    `file-${label}`,
    changePackage((packed) => {
      packed.files.push(value);
    })
  );
}
witness(
  "files-missing",
  changePackage((packed) => {
    delete packed.files;
  })
);
witness(
  "files-empty",
  changePackage((packed) => {
    packed.files = [];
  })
);
witness(
  "files-arraylike",
  changePackage((packed) => {
    packed.files = { ...packed.files, length: packed.files.length };
  })
);
witness(
  "file-array",
  changePackage((packed) => {
    packed.files.push([]);
  })
);
witness("package-array", [[]]);

for (const field of ["name", "version"]) {
  witness(
    `${field}-missing`,
    changePackage((packed) => {
      delete packed[field];
    })
  );
  for (const [label, value] of [
    ["null", null],
    ["boolean", true],
    ["number", 1],
    ["array", [valid[0][field]]],
    ["object", {}],
    ["wrong", "wrong"],
  ]) {
    witness(
      `${field}-${label}`,
      changePackage((packed) => {
        packed[field] = value;
      })
    );
  }
}

witness(
  "path-missing-extra",
  changePackage((packed) => {
    packed.files.push({ size: 1 });
  })
);
for (const [label, value] of [
  ["null", null],
  ["boolean", true],
  ["number", 1],
  ["array", ["legal.txt"]],
  ["object", {}],
  ["empty", ""],
]) {
  witness(
    `path-${label}-extra`,
    changePackage((packed) => {
      packed.files.push({ path: value, size: 1 });
    })
  );
}

witness(
  "size-missing",
  changeFile((file) => {
    delete file.size;
  })
);
witness(
  "size-missing-extra",
  changePackage((packed) => {
    packed.files.push({ path: "legal.txt" });
  })
);
for (const [label, value] of [
  ["null", null],
  ["false", false],
  ["zero", 0],
  ["negative", -1],
  ["fraction", 1.5],
  ["array", [1]],
  ["object", {}],
  ["empty-string", ""],
  ["numeric-string", " 1 "],
]) {
  witness(
    `size-${label}`,
    changeFile((file) => {
      file.size = value;
    })
  );
}
for (const [label, value] of [
  ["null", null],
  ["boolean", true],
  ["string", "1"],
  ["negative", -1],
  ["fraction", 1.5],
]) {
  witness(
    `size-${label}-extra`,
    changePackage((packed) => {
      packed.files.push({ path: "legal.txt", size: value });
    })
  );
}
// JSON can represent a number whose parsed value overflows to Infinity.
for (const literal of ["1e400", "-1e400", "NaN"]) {
  const response = changeFile((file) => {
    file.size = "overflow-marker";
  });
  witness(
    `size-${literal}`,
    JSON.stringify(response).replace('"overflow-marker"', literal)
  );
}

witness(
  "required-file-absent",
  changePackage((packed) => {
    packed.files = packed.files.filter(
      (file) => file.path !== "index.native.js"
    );
  })
);
for (const forbidden of ["example/", "node_modules/"]) {
  witness(
    `forbidden-${forbidden.slice(0, -1)}`,
    changePackage((packed) => {
      packed.files.push({ path: `${forbidden}unexpected.js`, size: 1 });
    })
  );
}

witness(
  "legal-extra-file",
  changePackage((packed) => {
    packed.files.push({
      path: "android/src/legal-extra.txt",
      size: 1,
      mode: 420,
    });
  }),
  true
);
// Empty unrelated files are supported npm metadata; required files must be > 0.
witness(
  "legal-empty-extra-file",
  changePackage((packed) => {
    packed.files.push({
      path: "android/src/legal-empty.txt",
      size: 0,
      mode: 420,
    });
  }),
  true
);
witness(
  "legal-unknown-fields",
  changePackage((packed) => {
    packed.futureMetadata = { enabled: true };
    packed.files[0].futureMetadata = null;
  }),
  true
);
witness(
  "legal-reordered-files",
  changePackage((packed) => {
    packed.files.reverse();
  }),
  true
);
witness(
  "legal-numeric-size",
  changeFile((file) => {
    file.size = 1e6;
  }),
  true
);

// Audit: Map insertion must not hide an earlier empty required-file entry.
witness(
  "duplicate-empty-required-first",
  changePackage((packed) => {
    packed.files.unshift({ path: "index.native.js", size: 0 });
  })
);
witness(
  "duplicate-required-path",
  changePackage((packed) => {
    packed.files.push({
      ...packed.files.find((file) => file.path === "index.native.js"),
    });
  })
);
witness(
  "duplicate-extra-path",
  changePackage((packed) => {
    packed.files.push(
      { path: "legal.txt", size: 1 },
      { path: "legal.txt", size: 1 }
    );
  })
);
witness(
  "legal-unused-metadata",
  changePackage((packed) => {
    packed.size = null;
    packed.files[0].mode = null;
  }),
  true
);
witness(
  "legal-unicode-extra-file",
  changePackage((packed) => {
    packed.files.push({ path: "android/src/caffè.txt", size: 1 });
  }),
  true
);
witness(
  "legal-prototype-named-paths",
  changePackage((packed) => {
    packed.files.push(
      { path: "__proto__", size: 1 },
      { path: "constructor", size: 1 }
    );
  }),
  true
);
