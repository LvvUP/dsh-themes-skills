// ../../../.dsh-themes/runtimes/0.1.3-alpha.1/vendor/cosmokit/src/misc.ts
function isNullable(value) {
  return value === null || value === void 0;
}
function isPlainObject(data) {
  return data && typeof data === "object" && !Array.isArray(data);
}
function filterKeys(object, filter) {
  return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
function mapValues(object, transform) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
function pick(source, keys, forced) {
  if (!keys) return { ...source };
  const result = {};
  for (const key of keys) {
    if (forced || source[key] !== void 0) result[key] = source[key];
  }
  return result;
}

// ../../../.dsh-themes/runtimes/0.1.3-alpha.1/vendor/cosmokit/src/types.ts
function is(type, value) {
  if (arguments.length === 1) return (value2) => is(type, value2);
  return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
  return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
  return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
var Binary;
((Binary2) => {
  Binary2.is = isArrayBufferLike;
  Binary2.isSource = isArrayBufferSource;
  function fromSource(source) {
    if (ArrayBuffer.isView(source)) {
      return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    } else {
      return source;
    }
  }
  Binary2.fromSource = fromSource;
  function toBase64(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") {
      return Buffer.from(source).toString("base64");
    }
    let binary = "";
    const bytes = new Uint8Array(source);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  Binary2.toBase64 = toBase64;
  function fromBase64(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
    return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
  }
  Binary2.fromBase64 = fromBase64;
  function toHex(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
    return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  Binary2.toHex = toHex;
  function fromHex(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
    const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
    const buffer = [];
    for (let i = 0; i < hex.length; i += 2) {
      buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
    }
    return Uint8Array.from(buffer).buffer;
  }
  Binary2.fromHex = fromHex;
})(Binary || (Binary = {}));
var base64ToArrayBuffer = Binary.fromBase64;
var arrayBufferToBase64 = Binary.toBase64;
var hexToArrayBuffer = Binary.fromHex;
var arrayBufferToHex = Binary.toHex;
function clone(source, refs = /* @__PURE__ */ new Map()) {
  if (!source || typeof source !== "object") return source;
  if (is("Date", source)) return new Date(source.valueOf());
  if (is("RegExp", source)) return new RegExp(source.source, source.flags);
  if (isArrayBufferLike(source)) return source.slice(0);
  if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  const cached = refs.get(source);
  if (cached) return cached;
  if (Array.isArray(source)) {
    const result2 = [];
    refs.set(source, result2);
    source.forEach((value, index) => {
      result2[index] = Reflect.apply(clone, null, [value, refs]);
    });
    return result2;
  }
  const result = Object.create(Object.getPrototypeOf(source));
  refs.set(source, result);
  for (const key of Reflect.ownKeys(source)) {
    const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
    if ("value" in descriptor) {
      descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
    }
    Reflect.defineProperty(result, key, descriptor);
  }
  return result;
}
function deepEqual(a, b, strict) {
  if (a === b) return true;
  if (!strict && isNullable(a) && isNullable(b)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (!a || !b) return false;
  function check(test, then) {
    return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
  }
  return check(Array.isArray, (a2, b2) => a2.length === b2.length && a2.every((item, index) => deepEqual(item, b2[index]))) ?? check(is("Date"), (a2, b2) => a2.valueOf() === b2.valueOf()) ?? check(is("RegExp"), (a2, b2) => a2.source === b2.source && a2.flags === b2.flags) ?? check(isArrayBufferLike, (a2, b2) => {
    if (a2.byteLength !== b2.byteLength) return false;
    const viewA = new Uint8Array(a2);
    const viewB = new Uint8Array(b2);
    for (let i = 0; i < viewA.length; i++) {
      if (viewA[i] !== viewB[i]) return false;
    }
    return true;
  }) ?? Object.keys({ ...a, ...b }).every((key) => deepEqual(a[key], b[key], strict));
}

// ../../../.dsh-themes/runtimes/0.1.3-alpha.1/vendor/cosmokit/src/time.ts
var Time;
((Time2) => {
  Time2.millisecond = 1;
  Time2.second = 1e3;
  Time2.minute = Time2.second * 60;
  Time2.hour = Time2.minute * 60;
  Time2.day = Time2.hour * 24;
  Time2.week = Time2.day * 7;
  let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
  function setTimezoneOffset(offset) {
    timezoneOffset = offset;
  }
  Time2.setTimezoneOffset = setTimezoneOffset;
  function getTimezoneOffset() {
    return timezoneOffset;
  }
  Time2.getTimezoneOffset = getTimezoneOffset;
  function getDateNumber(date2 = /* @__PURE__ */ new Date(), offset) {
    if (typeof date2 === "number") date2 = new Date(date2);
    if (offset === void 0) offset = timezoneOffset;
    return Math.floor((date2.valueOf() / Time2.minute - offset) / 1440);
  }
  Time2.getDateNumber = getDateNumber;
  function fromDateNumber(value, offset) {
    const date2 = new Date(value * Time2.day);
    if (offset === void 0) offset = timezoneOffset;
    return new Date(+date2 + offset * Time2.minute);
  }
  Time2.fromDateNumber = fromDateNumber;
  const numeric = /\d+(?:\.\d+)?/.source;
  const timeRegExp = new RegExp(`^${[
    "w(?:eek(?:s)?)?",
    "d(?:ay(?:s)?)?",
    "h(?:our(?:s)?)?",
    "m(?:in(?:ute)?(?:s)?)?",
    "s(?:ec(?:ond)?(?:s)?)?"
  ].map((unit) => `(${numeric}${unit})?`).join("")}$`);
  function parseTime(source) {
    const capture = timeRegExp.exec(source);
    if (!capture) return 0;
    return (parseFloat(capture[1]) * Time2.week || 0) + (parseFloat(capture[2]) * Time2.day || 0) + (parseFloat(capture[3]) * Time2.hour || 0) + (parseFloat(capture[4]) * Time2.minute || 0) + (parseFloat(capture[5]) * Time2.second || 0);
  }
  Time2.parseTime = parseTime;
  function parseDate(date2) {
    const parsed = parseTime(date2);
    if (parsed) {
      date2 = Date.now() + parsed;
    } else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) {
      date2 = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date2}`;
    } else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) {
      date2 = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date2}`;
    }
    return date2 ? new Date(date2) : /* @__PURE__ */ new Date();
  }
  Time2.parseDate = parseDate;
  function format(ms) {
    const abs = Math.abs(ms);
    if (abs >= Time2.day - Time2.hour / 2) {
      return Math.round(ms / Time2.day) + "d";
    } else if (abs >= Time2.hour - Time2.minute / 2) {
      return Math.round(ms / Time2.hour) + "h";
    } else if (abs >= Time2.minute - Time2.second / 2) {
      return Math.round(ms / Time2.minute) + "m";
    } else if (abs >= Time2.second) {
      return Math.round(ms / Time2.second) + "s";
    }
    return ms + "ms";
  }
  Time2.format = format;
  function toDigits(source, length = 2) {
    return source.toString().padStart(length, "0");
  }
  Time2.toDigits = toDigits;
  function template(template2, time = /* @__PURE__ */ new Date()) {
    return template2.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
  }
  Time2.template = template;
})(Time || (Time = {}));

// ../../../.dsh-themes/runtimes/0.1.3-alpha.1/vendor/schemastery/lib/index.mjs
var kSchema = /* @__PURE__ */ Symbol.for("schemastery");
var kValidationError = /* @__PURE__ */ Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
  options;
  name = "ValidationError";
  constructor(message, options) {
    let prefix = "$";
    for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
    else if (typeof segment === "number") prefix += "[" + segment + "]";
    else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
    if (prefix.startsWith(".")) prefix = prefix.slice(1);
    super((prefix === "$" ? "" : `${prefix} `) + message);
    this.options = options;
  }
  static is(error) {
    return !!error?.[kValidationError];
  }
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
var Schema = function(options) {
  const schema = function(data, options2 = {}) {
    return Schema.resolve(data, schema, options2)[0];
  };
  if (options.refs) {
    const refs = mapValues(options.refs, (options2) => new Schema(options2));
    const getRef = (uid) => refs[uid];
    for (const key in refs) {
      const options2 = refs[key];
      options2.sKey = getRef(options2.sKey);
      options2.inner = getRef(options2.inner);
      options2.list = options2.list && options2.list.map(getRef);
      options2.dict = options2.dict && mapValues(options2.dict, getRef);
    }
    return refs[options.uid];
  }
  Object.assign(schema, options);
  if (typeof schema.callback === "string") try {
    schema.callback = new Function("return " + schema.callback)();
  } catch {
  }
  Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
  Object.setPrototypeOf(schema, Schema.prototype);
  schema.meta ||= {};
  schema.toString = schema.toString.bind(schema);
  return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
  return {
    version: 1,
    vendor: "schemastery",
    validate: (value) => {
      try {
        return { value: Schema.resolve(value, this, {})[0] };
      } catch (error) {
        if (ValidationError.is(error)) return { issues: [{
          message: error.message,
          path: error.options.path
        }] };
        throw error;
      }
    }
  };
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
  if (globalThis.__schemastery_refs__) {
    globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
    return this.uid;
  }
  globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
  globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
  const result = {
    uid: this.uid,
    refs: globalThis.__schemastery_refs__
  };
  globalThis.__schemastery_refs__ = void 0;
  return result;
};
Schema.prototype.set = function set(key, value) {
  this.dict[key] = value;
  return this;
};
Schema.prototype.push = function push(value) {
  this.list.push(value);
  return this;
};
function mergeDesc(original, messages) {
  const result = typeof original === "string" ? { "": original } : { ...original };
  for (const locale in messages) {
    const value = messages[locale];
    if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
    else if (typeof value === "string") result[locale] = value;
  }
  return result;
}
function getInner(value) {
  return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
  return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
  const schema = Schema(this);
  const desc = mergeDesc(schema.meta.description, messages);
  if (Object.keys(desc).length) schema.meta.description = desc;
  if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
    return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
  });
  if (schema.list) schema.list = schema.list.map((inner, index) => {
    return inner.i18n(mapValues(messages, (data = {}) => {
      if (Array.isArray(getInner(data))) return getInner(data)[index];
      if (Array.isArray(data)) return data[index];
      return extractKeys(data);
    }));
  });
  if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
    if (getInner(data)) return getInner(data);
    return extractKeys(data);
  }));
  if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
  return schema;
};
Schema.prototype.extra = function extra(key, value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
};
for (const key of [
  "required",
  "disabled",
  "collapse",
  "hidden",
  "loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
} });
Schema.prototype.deprecated = function deprecated() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "deprecated",
    type: "danger"
  });
  return schema;
};
Schema.prototype.experimental = function experimental() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "experimental",
    type: "warning"
  });
  return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
  const schema = Schema(this);
  const pattern2 = pick(regexp, ["source", "flags"]);
  schema.meta = {
    ...schema.meta,
    pattern: pattern2
  };
  return schema;
};
Schema.prototype.simplify = function simplify(value) {
  if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
  if (isNullable(value)) return value;
  if (this.type === "object" || this.type === "dict") {
    const result = {};
    for (const key in value) {
      const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
      if (this.type === "dict" || !isNullable(item)) result[key] = item;
    }
    if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
    return result;
  } else if (this.type === "array" || this.type === "tuple") {
    const result = [];
    value.forEach((value2, index) => {
      const schema = this.type === "array" ? this.inner : this.list[index];
      const item = schema ? schema.simplify(value2) : value2;
      result.push(item);
    });
    return result;
  } else if (this.type === "intersect") {
    const result = {};
    for (const item of this.list) Object.assign(result, item.simplify(value));
    return result;
  } else if (this.type === "union") for (const schema of this.list) try {
    Schema.resolve(value, schema, {});
    return schema.simplify(value);
  } catch {
  }
  return value;
};
Schema.prototype.toString = function toString(inline) {
  return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra2) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    role,
    extra: extra2
  };
  return schema;
};
for (const key of [
  "default",
  "link",
  "comment",
  "description",
  "max",
  "min",
  "step"
]) Object.assign(Schema.prototype, { [key](value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
} });
var resolvers = {};
Schema.extend = function extend(type, resolve2) {
  resolvers[type] = resolve2;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
  if (!schema) return [data];
  if (options.ignore?.(data, schema)) return [data];
  if (isNullable(data) && schema.type !== "lazy") {
    if (schema.meta.required) throw new ValidationError(`missing required value`, options);
    let current = schema;
    let fallback = schema.meta.default;
    while (current?.type === "intersect" && isNullable(fallback)) {
      current = current.list[0];
      fallback = current?.meta.default;
    }
    if (isNullable(fallback)) return [data];
    data = clone(fallback);
  }
  const callback = resolvers[schema.type];
  if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
  try {
    return callback(data, schema, options, strict);
  } catch (error) {
    if (!schema.meta.loose) throw error;
    return [schema.meta.default];
  }
};
Schema.from = function from(source) {
  if (isNullable(source)) return Schema.any();
  else if ([
    "string",
    "number",
    "boolean"
  ].includes(typeof source)) return Schema.const(source).required();
  else if (source[kSchema]) return source;
  else if (typeof source === "function") switch (source) {
    case String:
      return Schema.string().required();
    case Number:
      return Schema.number().required();
    case Boolean:
      return Schema.boolean().required();
    case Function:
      return Schema.function().required();
    default:
      return Schema.is(source).required();
  }
  else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
  const toJSON2 = () => {
    if (!schema.inner[kSchema]) {
      schema.inner = schema.builder();
      schema.inner.meta = {
        ...schema.meta,
        ...schema.inner.meta
      };
    }
    return schema.inner.toJSON();
  };
  const schema = new Schema({
    type: "lazy",
    builder,
    inner: { toJSON: toJSON2 }
  });
  return schema;
};
Schema.natural = function natural() {
  return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
  return Schema.number().step(0.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
  return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
    const date2 = new Date(value);
    if (isNaN(+date2)) throw new ValidationError(`invalid date "${value}"`, options);
    return date2;
  }, true)]);
};
Schema.regExp = function regExp(flag = "") {
  return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
    try {
      return new RegExp(value, flag);
    } catch (e) {
      throw new ValidationError(e.message, options);
    }
  }, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
  return Schema.union([
    Schema.is(ArrayBuffer),
    Schema.is(SharedArrayBuffer),
    Schema.transform(Schema.any(), (value, options) => {
      if (Binary.isSource(value)) return Binary.fromSource(value);
      throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
    }, true),
    ...encoding ? [Schema.transform(Schema.string(), (value, options) => {
      try {
        return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
      } catch (e) {
        throw new ValidationError(e.message, options);
      }
    }, true)] : []
  ]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
  if (!schema.inner[kSchema]) {
    schema.inner = schema.builder();
    schema.inner.meta = {
      ...schema.meta,
      ...schema.inner.meta
    };
  }
  return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
  return [data];
});
Schema.extend("never", (data, _, options) => {
  throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
  if (deepEqual(data, value)) return [value];
  throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
  const { max = Infinity, min = -Infinity } = meta;
  if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
  if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
  if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
  if (meta.pattern) {
    const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
    if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
  }
  checkWithinRange(data.length, meta, "string length", options);
  return [data];
});
function decimalShift(data, digits) {
  const str = data.toString();
  if (str.includes("e")) return data * Math.pow(10, digits);
  const index = str.indexOf(".");
  if (index === -1) return data * Math.pow(10, digits);
  const frac = str.slice(index + 1);
  const integer = str.slice(0, index);
  if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
  return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
  step = Math.abs(step);
  if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
  const index = step.toString().indexOf(".");
  const digits = step.toString().slice(index + 1).length;
  return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
  if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
  checkWithinRange(data, meta, "number", options);
  const { step } = meta;
  if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
  return [data];
});
Schema.extend("boolean", (data, _, options) => {
  if (typeof data === "boolean") return [data];
  throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
  let value = 0, keys = [];
  if (typeof data === "number") {
    value = data;
    for (const key in bits) if (data & bits[key]) keys.push(key);
  } else if (Array.isArray(data)) {
    keys = data;
    for (const key of keys) {
      if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
      if (key in bits) value |= bits[key];
    }
  } else throw new ValidationError(`expected number or array but got ${data}`, options);
  if (value === meta.default) return [value];
  return [value, keys];
});
Schema.extend("function", (data, _, options) => {
  if (typeof data === "function") return [data];
  throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
  if (typeof constructor === "function") {
    if (data instanceof constructor) return [data];
    throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
  } else {
    if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
    let prototype = Object.getPrototypeOf(data);
    while (prototype) {
      if (prototype.constructor?.name === constructor) return [data];
      prototype = Object.getPrototypeOf(prototype);
    }
    throw new ValidationError(`expected ${constructor} but got ${data}`, options);
  }
});
function property(data, key, schema, options) {
  try {
    const [value, adapted] = Schema.resolve(data[key], schema, {
      ...options,
      path: [...options.path || [], key]
    });
    if (adapted !== void 0) data[key] = adapted;
    return value;
  } catch (e) {
    if (!options?.autofix) throw e;
    delete data[key];
    return schema.meta.default;
  }
}
Schema.extend("array", (data, { inner, meta }, options) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
  return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key in data) {
    let rKey;
    try {
      rKey = Schema.resolve(key, sKey, options)[0];
    } catch (error) {
      if (strict) continue;
      throw error;
    }
    result[rKey] = property(data, key, inner, options);
    data[rKey] = data[key];
    if (key !== rKey) delete data[key];
  }
  return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  const result = list.map((inner, index) => property(data, index, inner, options));
  if (strict) return [result];
  result.push(...data.slice(list.length));
  return [result];
});
function merge(result, data) {
  for (const key in data) {
    if (key in result) continue;
    result[key] = data[key];
  }
}
Schema.extend("object", (data, { dict }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key in dict) {
    const value = property(data, key, dict[key], options);
    if (!isNullable(value) || key in data) result[key] = value;
  }
  if (!strict) merge(result, data);
  return [result];
});
Schema.extend("union", (data, { list, toString: toString2 }, options, strict) => {
  const messages = [];
  for (const inner of list) try {
    return Schema.resolve(data, inner, options, strict);
  } catch (error) {
    messages.push(error);
  }
  throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString: toString2 }, options, strict) => {
  if (!list.length) return [data];
  let result;
  for (const inner of list) {
    const value = Schema.resolve(data, inner, options, true)[0];
    if (isNullable(value)) continue;
    if (isNullable(result)) result = value;
    else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
    else if (typeof value === "object") merge(result ??= {}, value);
    else if (result !== value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
  }
  if (!strict && isPlainObject(data)) merge(result, data);
  return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
  const [result, adapted = data] = Schema.resolve(data, inner, options, true);
  if (preserve) return [callback(result)];
  else return [callback(result), callback(adapted)];
});
var formatters = {};
function defineMethod(name, keys, format) {
  formatters[name] = format;
  Object.assign(Schema, { [name](...args) {
    const schema = new Schema({ type: name });
    keys.forEach((key, index) => {
      switch (key) {
        case "sKey":
          schema.sKey = args[index] ?? Schema.string();
          break;
        case "inner":
          schema.inner = Schema.from(args[index]);
          break;
        case "list":
          schema.list = args[index].map(Schema.from);
          break;
        case "dict":
          schema.dict = mapValues(args[index], Schema.from);
          break;
        case "bits":
          schema.bits = {};
          for (const key2 in args[index]) {
            if (typeof args[index][key2] !== "number") continue;
            schema.bits[key2] = args[index][key2];
          }
          break;
        case "callback": {
          const callback = schema.callback = args[index];
          callback["toJSON"] ||= () => callback.toString();
          break;
        }
        case "constructor": {
          const constructor = schema.constructor = args[index];
          if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
          break;
        }
        default:
          schema[key] = args[index];
      }
    });
    if (name === "object" || name === "dict") schema.meta.default = {};
    else if (name === "array" || name === "tuple") schema.meta.default = [];
    else if (name === "bitset") schema.meta.default = 0;
    return schema;
  } });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
  if (typeof constructor === "function") return constructor.name;
  else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
  if (Object.keys(dict).length === 0) return "{}";
  return `{ ${Object.entries(dict).map(([key, inner]) => {
    return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
  }).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
  const result = list.map(({ toString: format }) => format()).join(" | ");
  return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
  return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
  "inner",
  "callback",
  "preserve"
], ({ inner }, isInner) => inner.toString(isInner));

// themes/community-alpha/upstream/premium/src/theme-settings.ts
var PREMIUM_THEMES_SETTINGS_NAMESPACE = "dsh-community-premium";
var PALETTE_FIELD = "palette";
var BASE_FIELD = "base";
var CUSTOM_FIELD = "customPalettes";
var OFF = "off";
var CUSTOM_ID_PATTERN = /^[a-z0-9-]{1,40}$/;
var CUSTOM_THEME_ID_PATTERN = /^dsh-alpha-premium-custom-[a-z0-9-]{1,40}$/;
function isCustomThemeId(value) {
  return CUSTOM_THEME_ID_PATTERN.test(value);
}
var PALETTE_PREFERENCES = [
  "dsh-alpha-premium-tokyo-night",
  "dsh-alpha-premium-nord",
  "dsh-alpha-premium-catppuccin-mocha",
  "dsh-alpha-premium-everforest",
  "dsh-alpha-premium-rose-pine",
  "dsh-alpha-premium-ayu-mirage",
  "dsh-alpha-premium-catppuccin-latte",
  "dsh-alpha-premium-paper-gold"
];
var PALETTE_COLOR_SCHEMES = {
  "dsh-alpha-premium-tokyo-night": "dark",
  nord: "dark",
  "dsh-alpha-premium-catppuccin-mocha": "dark",
  everforest: "dark",
  "dsh-alpha-premium-rose-pine": "dark",
  "dsh-alpha-premium-ayu-mirage": "dark",
  "dsh-alpha-premium-catppuccin-latte": "light",
  "dsh-alpha-premium-paper-gold": "light"
};
var DEFAULT_SELECTION = OFF;
var DEFAULT_BASE = "system";
var DEFAULT_CUSTOMS = {};
var CustomPaletteSchema = Schema.object({
  id: Schema.string().pattern(CUSTOM_ID_PATTERN),
  name: Schema.string(),
  colorScheme: Schema.union(["light", "dark"]),
  colors: Schema.object({
    base: Schema.string(),
    accent: Schema.string(),
    text: Schema.string(),
    surface: Schema.string()
  }),
  tokens: Schema.dict(Schema.string())
});
var PremiumThemesSettingsSchema = Schema.object({
  [PALETTE_FIELD]: Schema.union([
    "off",
    "dsh-alpha-premium-tokyo-night",
    "dsh-alpha-premium-nord",
    "dsh-alpha-premium-catppuccin-mocha",
    "dsh-alpha-premium-everforest",
    "dsh-alpha-premium-rose-pine",
    "dsh-alpha-premium-ayu-mirage",
    "dsh-alpha-premium-catppuccin-latte",
    "dsh-alpha-premium-paper-gold",
    Schema.string().pattern(CUSTOM_THEME_ID_PATTERN)
  ]).default(DEFAULT_SELECTION),
  [BASE_FIELD]: Schema.union(["light", "dark", "system"]).default(DEFAULT_BASE),
  [CUSTOM_FIELD]: Schema.dict(CustomPaletteSchema).default(DEFAULT_CUSTOMS)
});
function isPaletteSelection(value) {
  if (typeof value !== "string") return false;
  if (value === OFF) return true;
  if (PALETTE_PREFERENCES.some((preference) => preference === value)) return true;
  return isCustomThemeId(value);
}
function isBasePreference(value) {
  return value === "light" || value === "dark" || value === "system";
}
var PALETTE_ROUTE_PATH = "/api/dsh-community-palettes/premium/palette";
var CUSTOM_ROUTE_PATH = "/api/dsh-community-palettes/premium/custom";

// themes/community-alpha/upstream/premium/src/boot.ts
function paletteSchemeOf(selection, customs) {
  if (selection === OFF) return void 0;
  if (isCustomThemeId(selection)) {
    const rawId = selection.slice("dsh-alpha-premium-custom-".length);
    return customs[rawId]?.colorScheme;
  }
  return PALETTE_COLOR_SCHEMES[selection];
}
function bootPaletteScript(selection, customs) {
  const scheme = paletteSchemeOf(selection, customs);
  if (scheme === void 0) return "";
  const dark = scheme === "dark";
  return `<script>(() => {
  // premium-themes: palette "${selection}" rides the ${scheme} base palette
  // (injected after ui-theme's bootstrap, so it wins the pre-plugin paint).
  document.documentElement.style.colorScheme = ${JSON.stringify(scheme)}
  document.body.toggleAttribute('data-ds-dark-theme', ${JSON.stringify(dark)})
})()</script>`;
}
function injectPaletteBoot(html, selection, customs = {}) {
  const script = bootPaletteScript(selection, customs);
  if (script === "") return html;
  const bodyClose = /<\/body>/i.exec(html);
  if (bodyClose === null) return `${html}${script}`;
  return `${html.slice(0, bodyClose.index)}${script}${html.slice(bodyClose.index)}`;
}

// themes/community-alpha/upstream/premium/src/derive.ts
function hexToRgb(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (match === null) {
    throw new TypeError(`premium-themes: "${hex}" is not a #rrggbb color`);
  }
  const value = Number.parseInt(match[1], 16);
  return { r: value >> 16 & 255, g: value >> 8 & 255, b: value & 255 };
}
function rgbToHex({ r, g, b }) {
  const channel = (value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}
function mix(from2, to, t) {
  const a = hexToRgb(from2);
  const b = hexToRgb(to);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  });
}
function luminance({ r, g, b }) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrastInk(color) {
  return luminance(hexToRgb(color)) > 0.45 ? "#161616" : "#ffffff";
}
function alpha(color, a) {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function lift(color, t, scheme) {
  return mix(color, scheme === "dark" ? "#ffffff" : "#000000", t);
}
function deriveCustomTokens(def) {
  const base = def.colors.base;
  const accent = def.colors.accent;
  hexToRgb(base);
  hexToRgb(accent);
  if (def.colors.text !== "") hexToRgb(def.colors.text);
  if (def.colors.surface !== "") hexToRgb(def.colors.surface);
  const scheme = def.colorScheme;
  const layer1 = base;
  const layer2 = def.colors.surface !== "" ? def.colors.surface : lift(base, 0.04, scheme);
  const layer3 = lift(base, 0.1, scheme);
  const overlay = lift(base, 0.16, scheme);
  const deeper = lift(base, 0.24, scheme);
  const text1 = def.colors.text !== "" ? def.colors.text : lift(base, 0.88, scheme);
  const text2 = lift(base, 0.7, scheme);
  const text3 = lift(base, 0.46, scheme);
  const dimmed = lift(base, 0.3, scheme);
  const accentHover = mix(accent, scheme === "dark" ? "#ffffff" : "#000000", 0.12);
  const onAccent = contrastInk(accent);
  const toast = scheme === "dark" ? deeper : mix(base, "#000000", 0.72);
  const whiteOverBlack = scheme === "dark";
  const tokens = {
    "--dsw-alias-bg-base": base,
    "--dsw-alias-bg-layer-1": layer1,
    "--dsw-alias-bg-layer-2": layer2,
    "--dsw-alias-bg-layer-3": layer3,
    "--dsw-alias-bg-overlay": overlay,
    "--dsw-alias-bg-module-platform": layer3,
    "--dsw-alias-bg-multi-select": layer2,
    "--dsw-alias-bg-skeleton": alpha(text1, scheme === "dark" ? 0.08 : 0.05),
    "--dsw-alias-bg-mask-drop": alpha(base, 0.72),
    "--dsw-alias-border-l1": alpha(text1, 0.08),
    "--dsw-alias-border-l2": alpha(text1, 0.14),
    "--dsw-alias-border-l2-darkmode-thin": alpha(text1, 0.08),
    "--dsw-alias-border-l3": alpha(text1, 0.2),
    "--dsw-alias-border-l4": alpha(text1, 0.28),
    "--dsw-alias-border-inverted": whiteOverBlack ? "rgba(0, 0, 0, 0.2)" : "rgba(255, 255, 255, 0.4)",
    "--dsw-alias-border-inverted2": whiteOverBlack ? "rgba(0, 0, 0, 0.34)" : "rgba(255, 255, 255, 0.6)",
    "--dsw-alias-brand-primary": accent,
    "--dsw-alias-brand-primary-invert": base,
    "--dsw-alias-brand-primary-new-colorprimary-new-color": accent,
    "--dsw-alias-brand-text": text1,
    "--dsw-alias-button-primary-fill": accent,
    "--dsw-alias-button-primary-hover": accentHover,
    "--dsw-alias-button-primary-dimmed": layer3,
    "--dsw-alias-button-info-fill": accent,
    "--dsw-alias-button-info-hover": accentHover,
    "--dsw-alias-button-contrast-fill": text1,
    "--dsw-alias-button-elevated-fill": scheme === "dark" ? layer3 : "#ffffff",
    "--dsw-alias-button-floating-fill": overlay,
    "--dsw-alias-button-floating-hover": deeper,
    "--dsw-alias-button-ghost-active-border": text3,
    "--dsw-alias-button-ghost-active-fill": layer3,
    "--dsw-alias-button-ghost-active-hover": overlay,
    "--dsw-alias-interactive-bg-hover": alpha(accent, 0.1),
    "--dsw-alias-interactive-bg-active": alpha(accent, 0.16),
    "--dsw-alias-interactive-bg-hover-accent": alpha(accent, 0.18),
    "--dsw-alias-interactive-bg-hover-solid": overlay,
    "--dsw-alias-interactive-bg-hover-danger": scheme === "dark" ? "rgba(242, 90, 90, 0.15)" : "rgba(236, 19, 19, 0.05)",
    "--dsw-alias-label-primary": text1,
    "--dsw-alias-label-secondary": text2,
    "--dsw-alias-label-tertiary": text3,
    "--dsw-alias-label-caption": text3,
    "--dsw-alias-label-dimmed": dimmed,
    "--dsw-alias-label-primary-foreground": onAccent,
    "--dsw-alias-label-primary-inverted": onAccent,
    "--dsw-alias-label-primary-bluish": accent,
    "--dsw-alias-label-primary-dimmed": dimmed,
    "--dsw-alias-markdown-code-block": layer2,
    "--dsw-alias-markdown-code-block-banner": layer3,
    "--dsw-alias-markdown-inline-code": layer3,
    "--dsw-alias-markdown-citation": overlay,
    "--dsw-alias-markdown-tag": layer3,
    "--dsw-alias-markdown-placeholder": layer2,
    "--dsw-alias-markdown-code-segment-selected": scheme === "dark" ? layer3 : "#ffffff",
    "--dsw-alias-markdown-code-segment-unselected": scheme === "dark" ? base : layer2,
    "--dsw-alias-scrollbar-bg-l1": overlay,
    "--dsw-alias-scrollbar-bg-l2": deeper,
    "--dsw-alias-scrollbar-hover-l1": deeper,
    "--dsw-alias-scrollbar-hover-l2": lift(base, 0.34, scheme),
    "--dsw-alias-state-business-primary": accent,
    "--dsw-alias-state-business-tertiary": layer3,
    "--dsw-alias-toast-bg": toast,
    "--dsw-alias-tooltip-bg": toast,
    "--dsw-specific-bubble": layer2,
    "--dsw-specific-bubble-highlight": layer3,
    "--dsw-specific-input-major": layer2,
    "--dsw-specific-login-input": base,
    "--dsw-specific-selector": layer3,
    "--dsw-specific-sidebar-fill": scheme === "dark" ? base : layer2,
    "--dsw-specific-sidebar-nav-item-active": layer3,
    "--dsw-specific-sidebar-nav-item-active-accent": overlay,
    "--dsw-specific-sidebar-nav-item-hover": lift(base, 0.06, scheme),
    "--dsw-specific-tip": layer3
  };
  return { ...tokens, ...def.tokens };
}

// themes/community-alpha/upstream/premium/src/index.ts
var THEME_NAMESPACE = PREMIUM_THEMES_SETTINGS_NAMESPACE;
function readSelection(settings) {
  if (settings === void 0) {
    return {
      [PALETTE_FIELD]: DEFAULT_SELECTION,
      [BASE_FIELD]: "system",
      [CUSTOM_FIELD]: { ...DEFAULT_CUSTOMS }
    };
  }
  const section = settings.get(THEME_NAMESPACE);
  const customs = section?.[CUSTOM_FIELD];
  return {
    [PALETTE_FIELD]: isPaletteSelection(section?.[PALETTE_FIELD]) ? section[PALETTE_FIELD] : DEFAULT_SELECTION,
    [BASE_FIELD]: isBasePreference(section?.[BASE_FIELD]) ? section[BASE_FIELD] : "system",
    [CUSTOM_FIELD]: customs !== null && typeof customs === "object" ? { ...customs } : {}
  };
}
function readBody(req) {
  return new Promise((resolve2, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      resolve2(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}
function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
async function readJson(req, res) {
  try {
    return JSON.parse(await readBody(req));
  } catch {
    json(res, 400, { error: "request body must be a JSON object" });
    return void 0;
  }
}
function normalizeImport(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name === "") return { error: "name is required" };
  let rawId = typeof body.id === "string" && body.id !== "" ? body.id : name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  if (rawId === "") rawId = `palette-${Date.now().toString(36)}`;
  const colorScheme = body.colorScheme === "dark" ? "dark" : body.colorScheme === "light" ? "light" : void 0;
  if (colorScheme === void 0) return { error: "colorScheme must be light or dark" };
  const colors = body.colors ?? {};
  const def = {
    id: rawId,
    name,
    colorScheme,
    colors: {
      base: typeof colors.base === "string" ? colors.base : "",
      accent: typeof colors.accent === "string" ? colors.accent : "",
      text: typeof colors.text === "string" ? colors.text : "",
      surface: typeof colors.surface === "string" ? colors.surface : ""
    },
    tokens: typeof body.tokens === "object" && body.tokens !== null ? { ...body.tokens } : {}
  };
  try {
    deriveCustomTokens(def);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  return { def };
}
async function paletteRouteHandler(settings, req, res) {
  if (req.method === "GET") {
    json(res, 200, readSelection(settings));
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end();
    return;
  }
  const body = await readJson(req, res);
  if (body === void 0) return;
  const base = body[BASE_FIELD];
  if (base !== void 0 && !isBasePreference(base)) {
    json(res, 400, { error: `"${BASE_FIELD}" must be light, dark, or system` });
    return;
  }
  if (settings === void 0) {
    json(res, 503, { error: "settings provider unavailable" });
    return;
  }
  const current = readSelection(settings);
  let palette = body[PALETTE_FIELD];
  if (palette === void 0) palette = current[PALETTE_FIELD];
  if (!isPaletteSelection(palette)) {
    json(res, 400, { error: `"${PALETTE_FIELD}" must be "off" or a registered palette id` });
    return;
  }
  if (isCustomThemeId(palette) && current[CUSTOM_FIELD][palette.slice("dsh-alpha-premium-custom-".length)] === void 0) {
    json(res, 400, { error: `unknown imported palette "${palette}"` });
    return;
  }
  try {
    await settings.update(THEME_NAMESPACE, {
      [PALETTE_FIELD]: palette,
      ...base === void 0 ? {} : { [BASE_FIELD]: base }
    });
  } catch (error) {
    json(res, 400, { error: error instanceof Error ? error.message : String(error) });
    return;
  }
  json(res, 200, readSelection(settings));
}
async function customRouteHandler(settings, req, res) {
  if (req.method === "GET") {
    json(res, 200, readSelection(settings)[CUSTOM_FIELD]);
    return;
  }
  if (req.method !== "POST" && req.method !== "DELETE") {
    res.writeHead(405);
    res.end();
    return;
  }
  if (settings === void 0) {
    json(res, 503, { error: "settings provider unavailable" });
    return;
  }
  const body = await readJson(req, res);
  if (body === void 0) return;
  const current = readSelection(settings);
  const customs = { ...current[CUSTOM_FIELD] };
  if (req.method === "POST") {
    const { def, error } = normalizeImport(body);
    if (def === void 0) {
      json(res, 400, { error: error ?? "invalid palette definition" });
      return;
    }
    customs[def.id] = def;
    try {
      await settings.update(THEME_NAMESPACE, { [CUSTOM_FIELD]: customs });
    } catch (error2) {
      json(res, 400, { error: error2 instanceof Error ? error2.message : String(error2) });
      return;
    }
    json(res, 200, { ...readSelection(settings), imported: def.id });
    return;
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (customs[id] === void 0) {
    json(res, 404, { error: `unknown imported palette "${id}"` });
    return;
  }
  delete customs[id];
  const nextPalette = current[PALETTE_FIELD] === `dsh-alpha-premium-custom-${id}` ? "off" : current[PALETTE_FIELD];
  try {
    await settings.replace(THEME_NAMESPACE, {
      [PALETTE_FIELD]: nextPalette,
      [BASE_FIELD]: current[BASE_FIELD],
      [CUSTOM_FIELD]: customs
    });
  } catch (error) {
    json(res, 400, { error: error instanceof Error ? error.message : String(error) });
    return;
  }
  json(res, 200, readSelection(settings));
}
function apply(ctx) {
  ctx.inject(["settings"], (settingsCtx) => {
    settingsCtx.settings.register(THEME_NAMESPACE, PremiumThemesSettingsSchema);
  });
  ctx.inject(["webServer"], (httpCtx) => {
    const settings = () => ctx.get("settings");
    httpCtx.effect(
      () => httpCtx.webServer.tapIndex((html) => {
        const section = readSelection(settings());
        return injectPaletteBoot(html, section[PALETTE_FIELD], section[CUSTOM_FIELD]);
      }),
      "client-dsh-community-premium: palette bootstrap"
    );
    httpCtx.effect(
      () => httpCtx.webServer.register({
        kind: "exact",
        path: PALETTE_ROUTE_PATH,
        handler: (req, res) => paletteRouteHandler(settings(), req, res)
      }),
      "client-dsh-community-premium: palette route"
    );
    httpCtx.effect(
      () => httpCtx.webServer.register({
        kind: "exact",
        path: CUSTOM_ROUTE_PATH,
        handler: (req, res) => customRouteHandler(settings(), req, res)
      }),
      "client-dsh-community-premium: custom palette route"
    );
  });
}
export {
  BASE_FIELD,
  CUSTOM_FIELD,
  CUSTOM_ROUTE_PATH,
  DEFAULT_SELECTION,
  OFF,
  PALETTE_FIELD,
  PALETTE_PREFERENCES,
  PALETTE_ROUTE_PATH,
  PREMIUM_THEMES_SETTINGS_NAMESPACE,
  PremiumThemesSettingsSchema,
  apply,
  customRouteHandler,
  isPaletteSelection,
  paletteRouteHandler
};
