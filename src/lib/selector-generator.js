/**
 * Lightweight CSS Selector Generator
 * Generates CSS selectors for DOM elements
 */

const DEFAULT_BLACKLIST = ['css-*', 'sc-*', 'emotion-*', 'makeStyles-*', 'Mui*', 'picker-*', /^[0-9]+$/];

const DEFAULT_PRIORITY = ['id', 'class', 'tagClass'];

// Common utility CSS class prefixes that are too generic to be useful
const UTILITY_PREFIXES = [
  'flex',
  'grid',
  'block',
  'inline',
  'hidden',
  'visible',
  'overflow',
  'relative',
  'absolute',
  'fixed',
  'sticky',
  'static',
  'w-',
  'h-',
  'min-w',
  'min-h',
  'max-w',
  'max-h',
  'p-',
  'px-',
  'py-',
  'pt-',
  'pb-',
  'pl-',
  'pr-',
  'm-',
  'mx-',
  'my-',
  'mt-',
  'mb-',
  'ml-',
  'mr-',
  'text-',
  'font-',
  'leading-',
  'tracking-',
  'whitespace',
  'bg-',
  'border',
  'rounded',
  'shadow',
  'ring',
  'hover\\:',
  'focus\\:',
  'active\\:',
  'disabled\\:',
  'group',
  'items-',
  'justify-',
  'content-',
  'self-',
  'place-',
  'gap-',
  'space-',
  'order-',
  'col-',
  'row-',
  'z-',
  'top-',
  'bottom-',
  'left-',
  'right-',
  'cursor-',
  'select-',
  'pointer-events',
  'resize',
  'transition',
  'duration-',
  'delay-',
  'ease-',
  'transform',
  'scale-',
  'rotate-',
  'translate-',
  'opacity-',
  'mix-blend',
  'filter',
  'backdrop',
  'sr-only',
  'not-sr-only',
  'truncate',
  'overflow-',
  'scrollbar',
  'appearance-',
  'outline',
  'antialiased',
  'subpixel',
  'table-',
  'caption-',
  'border-',
  'list-',
  'align-',
  'valign',
  'box-',
  'clear-',
  'float-',
  'object-',
  'fit-',
  'isolate',
  'isolation',
  'inset-',
  'start-',
  'end-',
  'basis-',
  'grow',
  'shrink',
  'aspect-',
  'container',
  'divide-',
  'sort-',
  'line-clamp',
  'break-',
  'decoration-',
  'underline',
  'no-underline',
  'caret-',
  'accent-',
  'scroll-',
  'snap-',
  'touch-',
  'overscroll-'
];

function isUtilityClass(cls) {
  return UTILITY_PREFIXES.some((prefix) => cls.startsWith(prefix));
}

function isBlacklisted(className, blacklist) {
  return blacklist.some((pattern) => {
    if (typeof pattern === 'string') {
      if (pattern.endsWith('*')) {
        return className.startsWith(pattern.slice(0, -1));
      }
      return className === pattern;
    }
    if (pattern instanceof RegExp) {
      return pattern.test(className);
    }
    return false;
  });
}

function getValidClasses(element, blacklist) {
  const className = element.className;
  if (!className || typeof className !== 'string') {
    return [];
  }
  const classes = className.split(/\s+/).filter((cls) => cls && !isBlacklisted(cls, blacklist));
  // Return semantic classes first, then utility classes
  return classes.sort((a, b) => {
    const aIsUtil = isUtilityClass(a);
    const bIsUtil = isUtilityClass(b);
    if (aIsUtil && !bIsUtil) return 1;
    if (!aIsUtil && bIsUtil) return -1;
    return 0;
  });
}

function getIdSelector(element) {
  if (element.id) {
    const cleanId = element.id.replace(/[^\w-]/g, '\\$&');
    try {
      if (document.querySelectorAll(`#${cleanId}`).length === 1) {
        return `#${cleanId}`;
      }
    } catch (e) {
      // Invalid selector characters
    }
  }
  return null;
}

function getClassSelector(element, blacklist, preferReusable) {
  const classes = getValidClasses(element, blacklist);

  // Try single class first
  for (const cls of classes) {
    try {
      const selector = `.${cls.replace(/[^\w-]/g, '\\$&')}`;
      const count = document.querySelectorAll(selector).length;
      if (count === 1) {
        return selector;
      }
      if (preferReusable && count > 1) {
        return selector;
      }
    } catch (e) {
      // Invalid selector
    }
  }

  // Try 2-class combinations (prioritize semantic classes)
  const maxSingle = Math.min(classes.length, 8);
  for (let i = 0; i < maxSingle; i++) {
    for (let j = i + 1; j < maxSingle; j++) {
      try {
        const selector = `.${classes[i].replace(/[^\w-]/g, '\\$&')}.${classes[j].replace(/[^\w-]/g, '\\$&')}`;
        const count = document.querySelectorAll(selector).length;
        if (count === 1) {
          return selector;
        }
        if (preferReusable && count > 1) {
          return selector;
        }
      } catch (e) {
        // Invalid selector
      }
    }
  }

  return null;
}

function getTagClassSelector(element, blacklist, preferReusable) {
  const classes = getValidClasses(element, blacklist);
  const tagName = element.tagName.toLowerCase();

  // Try single class
  for (const cls of classes) {
    try {
      const safeClass = cls.replace(/[^\w-]/g, '\\$&');
      const selector = `${tagName}.${safeClass}`;
      const count = document.querySelectorAll(selector).length;
      if (count === 1) {
        return selector;
      }
      if (preferReusable && count > 1) {
        return selector;
      }
    } catch (e) {
      // Invalid selector
    }
  }

  // Try 2-class combinations
  const maxSingle = Math.min(classes.length, 8);
  for (let i = 0; i < maxSingle; i++) {
    for (let j = i + 1; j < maxSingle; j++) {
      try {
        const selector = `${tagName}.${classes[i].replace(/[^\w-]/g, '\\$&')}.${classes[j].replace(/[^\w-]/g, '\\$&')}`;
        const count = document.querySelectorAll(selector).length;
        if (count === 1) {
          return selector;
        }
        if (preferReusable && count > 1) {
          return selector;
        }
      } catch (e) {
        // Invalid selector
      }
    }
  }

  return null;
}

function getTagPath(element, root) {
  const path = [];
  let current = element;

  while (current && current !== root && current !== document.body) {
    const tagName = current.tagName.toLowerCase();
    path.unshift({ tag: tagName });
    current = current.parentElement;
  }

  return path;
}

function buildTagPathSelector(path) {
  return path.map((p) => p.tag).join(' > ');
}

function getCssSelector(element, options = {}) {
  // [DEBUG] Log entry
  console.log('[SelectorGen:DEBUG] getCssSelector called:', {
    elementTag: element?.tagName,
    elementClass: element?.className,
    elementId: element?.id,
    instanceofElement: element instanceof Element,
    rootTag: (options.root || document.body)?.tagName,
    rootClass: (options.root || document.body)?.className,
    rootId: (options.root || document.body)?.id,
    preferReusable: options.preferReusable
  });

  if (!element || !(element instanceof Element)) {
    throw new Error('Invalid element provided');
  }

  if (element.shadowRoot || (element.getRootNode && element.getRootNode().host)) {
    console.warn('Shadow DOM detected - selector generation may be inaccurate');
  }

  const root = options.root || document.body;
  const blacklist = options.blacklist || DEFAULT_BLACKLIST;
  const priority = options.selectors || DEFAULT_PRIORITY;
  const preferReusable = options.preferReusable || false;

  for (const strategy of priority) {
    let selector = null;

    switch (strategy) {
      case 'id':
        selector = getIdSelector(element);
        break;
      case 'class':
        selector = getClassSelector(element, blacklist, preferReusable);
        break;
      case 'tagClass':
        selector = getTagClassSelector(element, blacklist, preferReusable);
        break;
      default:
        continue;
    }

    if (selector) {
      try {
        const matches = root.querySelectorAll(selector);
        if (matches.length === 1 && matches[0] === element) {
          return selector;
        }
        if (preferReusable && matches.length > 1 && Array.from(matches).includes(element)) {
          return selector;
        }
      } catch (e) {
        // Invalid selector, continue
      }
    }
  }

  // Fallback 1: try anchored selector
  const anchored = getAnchoredSelector(element, root, blacklist);
  // [DEBUG] Log anchored result
  console.log('[SelectorGen:DEBUG] anchored selector:', anchored);
  if (anchored) return anchored;

  // Fallback 2: pure tag path (no nth-child), e.g. dd > h3 > a
  const path = getTagPath(element, root);
  const tagPathResult = buildTagPathSelector(path);
  // [DEBUG] Log tag path result
  console.log('[SelectorGen:DEBUG] tag path:', { path: path.map((p) => p.tag), selector: tagPathResult });
  return tagPathResult;
}

function getAnchoredSelector(element, root, blacklist) {
  let anchor = null;
  let current = element.parentElement;
  while (current && current !== document.body && current !== root.parentElement) {
    if (current.id) {
      anchor = current;
      break;
    }
    const classes = getValidClasses(current, blacklist);
    if (classes.length > 0) {
      anchor = current;
      break;
    }
    current = current.parentElement;
  }

  // [DEBUG] Log anchor search result
  console.log('[SelectorGen:DEBUG] getAnchoredSelector:', {
    anchorFound: !!anchor,
    anchorTag: anchor?.tagName,
    anchorClass: anchor?.className,
    anchorId: anchor?.id,
    anchorIsRoot: anchor === root,
    rootTag: root?.tagName,
    rootClass: root?.className
  });

  if (!anchor) return null;

  // Build path from element to anchor
  const path = [];
  current = element;
  while (current && current !== anchor) {
    const tag = current.tagName.toLowerCase();
    path.unshift({ tag });
    current = current.parentElement;
  }

  const anchorTag = anchor.tagName.toLowerCase();
  const anchorId = anchor.id ? `#${anchor.id}` : '';
  const anchorClasses = getValidClasses(anchor, blacklist);
  const anchorClassStr = anchorClasses.map((c) => `.${c.replace(/[^\w-]/g, '\\$&')}`).join('');
  const anchorSelector = `${anchorTag}${anchorId}${anchorClassStr}`;

  const childPath = path.map((p) => p.tag).join(' > ');

  const fullSelector = childPath ? `${anchorSelector} > ${childPath}` : anchorSelector;

  // [DEBUG] Log selector validation
  let rootQsaResult = -1;
  let docQsaResult = -1;
  try {
    rootQsaResult = root.querySelectorAll(fullSelector).length;
  } catch (e) {
    rootQsaResult = -2;
  }
  try {
    docQsaResult = document.querySelectorAll(fullSelector).length;
  } catch (e) {
    docQsaResult = -2;
  }
  console.log('[SelectorGen:DEBUG] getAnchoredSelector validation:', {
    fullSelector,
    rootQsaResult,
    docQsaResult,
    anchorIsRoot: anchor === root
  });

  try {
    if (root.querySelectorAll(fullSelector).length > 0) {
      return fullSelector;
    }
  } catch (e) {
    /* skip */
  }
  return null;
}

function getIntersectionSelector(el1, el2, options = {}) {
  const blacklist = options.blacklist || DEFAULT_BLACKLIST;

  // 优先使用完整路径的列表项选择器，避免只返回兄弟层级选择器导致越界匹配。
  const siblingPair = getSiblingLevelPair(el1, el2);
  if (siblingPair) {
    const fullPathSelector = buildFullPathListSelector(siblingPair.item1, siblingPair.item2, blacklist);
    if (fullPathSelector) return fullPathSelector;
  }

  // Fallback: original logic using the clicked elements directly
  const classes1 = getValidClasses(el1, blacklist);
  const classes2 = getValidClasses(el2, blacklist);
  const commonClasses = classes1.filter((cls) => classes2.includes(cls));
  const tagMatches = el1.tagName.toLowerCase() === el2.tagName.toLowerCase();
  const tagName = tagMatches ? el1.tagName.toLowerCase() : '';

  // Strategy 1: Same tag with common classes
  if (tagMatches && commonClasses.length > 0) {
    const safeClasses = commonClasses.map((cls) => cls.replace(/[^\w-]/g, '\\$&'));
    const selector = `${tagName}.${safeClasses.join('.')}`;
    try {
      if (document.querySelectorAll(selector).length > 0) {
        return selector;
      }
    } catch (e) {
      /* skip */
    }
  }

  // Strategy 2: Same tag via common parent (e.g. ul > li)
  if (tagMatches) {
    const parent1 = el1.parentElement;
    const parent2 = el2.parentElement;
    if (parent1 === parent2 && !['BODY', 'HTML', '#document'].includes(parent1.tagName)) {
      const parentTagName = parent1.tagName.toLowerCase();
      const parentClass = parent1.id
        ? `#${parent1.id}`
        : parent1.className
          ? `.${
              parent1.className
                .trim()
                .split(/\s+/)
                .filter((c) => !isBlacklisted(c, blacklist))[0]
            }`
          : '';
      const baseSelector = `${parentTagName}${parentClass} > ${tagName}`;

      let bestSelector = null;
      let bestCount = Infinity;

      // Try base selector and each ancestor-scoped version, pick the most specific
      const trySelector = (selector) => {
        try {
          const count = document.querySelectorAll(selector).length;
          if (count > 1 && count < bestCount) {
            bestSelector = selector;
            bestCount = count;
          }
        } catch (e) {
          /* skip */
        }
      };

      trySelector(baseSelector);

      let ancestor = parent1.parentElement;
      while (ancestor && !['BODY', 'HTML', '#document'].includes(ancestor.tagName)) {
        const ancTag = ancestor.tagName.toLowerCase();
        const ancId = ancestor.id ? `#${ancestor.id}` : '';
        const ancClasses = ancestor.className
          ? ancestor.className
              .trim()
              .split(/\s+/)
              .filter((c) => !isBlacklisted(c, blacklist))
              .map((c) => `.${c.replace(/[^\w-]/g, '\\$&')}`)
              .join('')
          : '';
        trySelector(`${ancTag}${ancId}${ancClasses} ${baseSelector}`);
        ancestor = ancestor.parentElement;
      }

      return bestSelector;
    }
  }

  // Strategy 3: Same tag only
  if (tagMatches) {
    try {
      if (document.querySelectorAll(tagName).length > 0) {
        return tagName;
      }
    } catch (e) {
      /* skip */
    }
  }

  return null;
}

function getSiblingLevelPair(el1, el2) {
  // 当前层已经是兄弟节点时，直接作为列表项候选。
  if (el1 !== el2 && el1.parentElement && el1.parentElement === el2.parentElement) {
    return { item1: el1, item2: el2 };
  }

  // 不同深度场景：通过最近公共祖先收敛到分叉层，得到真正的同层候选。
  return getSiblingPairViaLca(el1, el2);
}

function getSiblingPairViaLca(el1, el2) {
  const path1 = [];
  const path2 = [];

  for (let cur = el1; cur && cur !== document.body && cur !== document.documentElement; cur = cur.parentElement) {
    path1.push(cur);
  }
  for (let cur = el2; cur && cur !== document.body && cur !== document.documentElement; cur = cur.parentElement) {
    path2.push(cur);
  }

  let i = path1.length - 1;
  let j = path2.length - 1;
  let lca = null;

  while (i >= 0 && j >= 0 && path1[i] === path2[j]) {
    lca = path1[i];
    i--;
    j--;
  }

  if (!lca || i < 0 || j < 0) return null;

  const child1 = path1[i];
  const child2 = path2[j];
  if (!child1 || !child2 || child1 === child2) return null;
  if (child1.parentElement !== lca || child2.parentElement !== lca) return null;

  return { item1: child1, item2: child2 };
}

function buildFullPathListSelector(el1, el2, blacklist) {
  const tag1 = el1.tagName.toLowerCase();
  const tag2 = el2.tagName.toLowerCase();
  if (tag1 !== tag2) return null;

  const parent = el1.parentElement;
  if (!parent || parent !== el2.parentElement || ['BODY', 'HTML', '#document'].includes(parent.tagName)) {
    return null;
  }

  const classes1 = getValidClasses(el1, blacklist);
  const classes2 = getValidClasses(el2, blacklist);
  const commonClasses = classes1.filter((cls) => classes2.includes(cls));
  const itemClassStr =
    commonClasses.length > 0 ? commonClasses.map((c) => `.${c.replace(/[^\w-]/g, '\\$&')}`).join('') : '';
  const itemSelector = `${tag1}${itemClassStr}`;

  const parentPath = buildAncestorPath(parent, blacklist);
  const fullSelector = parentPath ? `${parentPath} > ${itemSelector}` : itemSelector;

  try {
    const matches = Array.from(document.querySelectorAll(fullSelector));
    if (matches.length > 1 && matches.includes(el1) && matches.includes(el2)) {
      return fullSelector;
    }
  } catch (e) {
    /* skip */
  }

  return null;
}

function buildAncestorPath(node, blacklist) {
  const parts = [];
  let current = node;

  while (current && !['BODY', 'HTML', '#document'].includes(current.tagName)) {
    const tag = current.tagName.toLowerCase();
    if (current.id) {
      parts.unshift(`${tag}#${current.id.replace(/[^\w-]/g, '\\$&')}`);
    } else {
      const classes = getValidClasses(current, blacklist).slice(0, 2);
      const classStr = classes.map((c) => `.${c.replace(/[^\w-]/g, '\\$&')}`).join('');
      parts.unshift(`${tag}${classStr}`);
    }
    current = current.parentElement;
  }

  return parts.join(' > ');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getCssSelector, getIntersectionSelector };
}
