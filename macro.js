function _interopDefault(ex) {
  return ex && typeof ex === 'object' && 'default' in ex ? ex['default'] : ex
}

var babelPluginMacros = require('babel-plugin-macros')
var path = require('path')
var fs = require('fs')
var dset = _interopDefault(require('dset'))
var resolveConfig = _interopDefault(
  require('tailwindcss/lib/util/resolveConfig.js')
)
var defaultTailwindConfig = _interopDefault(
  require('tailwindcss/stubs/defaultConfig.stub.js')
)
var dlv = _interopDefault(require('dlv'))
var babylon = _interopDefault(require('@babel/parser'))

function findIdentifier(ref) {
  var program = ref.program
  var mod = ref.mod
  var name = ref.name

  var identifier = null
  program.traverse({
    ImportDeclaration: function ImportDeclaration(path$$1) {
      if (path$$1.node.source.value !== mod) {
        return
      }
      path$$1.node.specifiers.some(function(specifier) {
        if (specifier.type === 'ImportDefaultSpecifier') {
          if (name === 'default') {
            identifier = specifier.local
            return true
          }
        } else if (specifier.imported.name === name) {
          identifier = specifier.local
          return true
        }

        return false
      })
    }
  })
  return identifier
}

function replaceWithLocation(path$$1, replacement) {
  var loc = path$$1.node.loc
  var newPaths = path$$1.replaceWith(replacement)

  if (Array.isArray(newPaths)) {
    newPaths.forEach(function(p) {
      p.node.loc = loc
    })
  }

  return newPaths
}

function parseTte(ref) {
  var path$$1 = ref.path
  var t = ref.types
  var styledIdentifier = ref.styledIdentifier
  var state = ref.state

  var cloneNode = t.cloneNode || t.cloneDeep
  if (
    path$$1.node.tag.type !== 'Identifier' &&
    path$$1.node.tag.type !== 'MemberExpression' &&
    path$$1.node.tag.type !== 'CallExpression'
  ) {
    return null
  }
  var str = path$$1.get('quasi').get('quasis')[0].node.value.cooked
  var strLoc = path$$1.get('quasi').node.loc

  if (path$$1.node.tag.type === 'CallExpression') {
    replaceWithLocation(
      path$$1.get('tag').get('callee'),
      cloneNode(styledIdentifier)
    )
    state.shouldImportStyled = true
  } else if (path$$1.node.tag.type === 'MemberExpression') {
    replaceWithLocation(
      path$$1.get('tag').get('object'),
      cloneNode(styledIdentifier)
    )
    state.shouldImportStyled = true
  }

  if (
    path$$1.node.tag.type === 'CallExpression' ||
    path$$1.node.tag.type === 'MemberExpression'
  ) {
    replaceWithLocation(
      path$$1,
      t.callExpression(cloneNode(path$$1.node.tag), [
        t.identifier('__twPlaceholder')
      ])
    )
    path$$1 = path$$1.get('arguments')[0]
  }

  path$$1.node.loc = strLoc
  return {
    str: str,
    path: path$$1
  }
}

function addImport(ref) {
  var t = ref.types
  var program = ref.program
  var mod = ref.mod
  var name = ref.name
  var identifier = ref.identifier

  if (name === 'default') {
    program.unshiftContainer(
      'body',
      t.importDeclaration(
        [t.importDefaultSpecifier(identifier)],
        t.stringLiteral(mod)
      )
    )
  } else {
    program.unshiftContainer(
      'body',
      t.importDeclaration(
        [t.importSpecifier(identifier, t.identifier(name))],
        t.stringLiteral(mod)
      )
    )
  }
}

var staticStyles = {
  // https://tailwindcss.com/docs/display
  block: {
    display: 'block'
  },
  'inline-block': {
    display: 'inline-block'
  },
  inline: {
    display: 'inline'
  },
  flex: {
    display: 'flex'
  },
  'inline-flex': {
    display: 'inline-flex'
  },
  table: {
    display: 'table'
  },
  'table-row': {
    display: 'table-row'
  },
  'table-cell': {
    display: 'table-cell'
  },
  hidden: {
    display: 'none'
  },
  // https://tailwindcss.com/docs/float
  'float-right': {
    float: 'right'
  },
  'float-left': {
    float: 'left'
  },
  'float-none': {
    float: 'none'
  },
  clearfix: {
    '::after': {
      content: '""',
      display: 'table',
      clear: 'both'
    }
  },
  // https://tailwindcss.com/docs/object-fit
  'object-contain': {
    objectFit: 'contain'
  },
  'object-cover': {
    objectFit: 'cover'
  },
  'object-fill': {
    objectFit: 'fill'
  },
  'object-none': {
    objectFit: 'none'
  },
  'object-scale-down': {
    objectFit: 'scale-down'
  },
  // https://tailwindcss.com/docs/overflow
  'overflow-auto': {
    overflow: 'auto'
  },
  'overflow-hidden': {
    overflow: 'hidden'
  },
  'overflow-visible': {
    overflow: 'visible'
  },
  'overflow-scroll': {
    overflow: 'scroll'
  },
  'overflow-x-auto': {
    overflowX: 'auto'
  },
  'overflow-y-auto': {
    overflowY: 'auto'
  },
  'overflow-x-hidden': {
    overflowX: 'hidden'
  },
  'overflow-y-hidden': {
    overflowY: 'hidden'
  },
  'overflow-x-visible': {
    overflowX: 'visible'
  },
  'overflow-y-visible': {
    overflowY: 'visible'
  },
  'overflow-x-scroll': {
    overflowX: 'scroll'
  },
  'overflow-y-scroll': {
    overflowY: 'scroll'
  },
  'scrolling-touch': {
    WebkitOverflowScrolling: 'touch'
  },
  'scrolling-auto': {
    WebkitOverflowScrolling: 'auto'
  },
  // https://tailwindcss.com/docs/position
  static: {
    position: 'static'
  },
  fixed: {
    position: 'fixed'
  },
  absolute: {
    position: 'absolute'
  },
  relative: {
    position: 'relative'
  },
  sticky: {
    position: 'sticky'
  },
  // https://tailwindcss.com/docs/visibility
  visible: {
    visibility: 'visible'
  },
  invisible: {
    visibility: 'hidden'
  },
  // https://tailwindcss.com/docs/list-style-position
  'list-inside': {
    listStylePosition: 'inside'
  },
  'list-outside': {
    listStylePosition: 'outside'
  },
  // https://tailwindcss.com/docs/text-style
  italic: {
    fontStyle: 'italic'
  },
  'not-italic': {
    fontStyle: 'normal'
  },
  uppercase: {
    textTransform: 'uppercase'
  },
  lowercase: {
    textTransform: 'lowercase'
  },
  capitalize: {
    textTransform: 'capitalize'
  },
  'normal-case': {
    textTransform: 'none'
  },
  underline: {
    textDecoration: 'underline'
  },
  'line-through': {
    textDecoration: 'line-through'
  },
  'no-underline': {
    textDecoration: 'none'
  },
  antialiased: {
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  },
  'subpixel-antialiased': {
    WebkitFontSmoothing: 'auto',
    MozOsxFontSmoothing: 'auto'
  },
  // https://tailwindcss.com/docs/text-align
  'text-left': {
    textAlign: 'left'
  },
  'text-center': {
    textAlign: 'center'
  },
  'text-right': {
    textAlign: 'right'
  },
  'text-justify': {
    textAlign: 'justify'
  },
  // https://tailwindcss.com/docs/vertical-align
  'align-baseline': {
    verticalAlign: 'baseline'
  },
  'align-top': {
    verticalAlign: 'top'
  },
  'align-middle': {
    verticalAlign: 'middle'
  },
  'align-bottom': {
    verticalAlign: 'bottom'
  },
  'align-text-top': {
    verticalAlign: 'text-top'
  },
  'align-text-bottom': {
    verticalAlign: 'text-bottom'
  },
  // https://tailwindcss.com/docs/whitespace
  'whitespace-normal': {
    whiteSpace: 'normal'
  },
  'whitespace-no-wrap': {
    whiteSpace: 'nowrap'
  },
  'whitespace-pre': {
    whiteSpace: 'pre'
  },
  'whitespace-pre-line': {
    whiteSpace: 'pre-line'
  },
  'whitespace-pre-wrap': {
    whiteSpace: 'pre-wrap'
  },
  // https://tailwindcss.com/docs/word-break
  'break-normal': {
    wordBreak: 'normal',
    overflowWrap: 'normal'
  },
  'break-words': {
    wordWrap: 'break-word'
  },
  'break-all': {
    wordBreak: 'normal'
  },
  truncate: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  // https://tailwindcss.com/docs/background-attachment
  'bg-fixed': {
    backgroundAttachment: 'fixed'
  },
  'bg-local': {
    backgroundAttachment: 'local'
  },
  'bg-scroll': {
    backgroundAttachment: 'scroll'
  },
  // https://tailwindcss.com/docs/background-repeat
  'bg-repeat': {
    backgroundRepeat: 'repeat'
  },
  'bg-no-repeat': {
    backgroundRepeat: 'no-repeat'
  },
  'bg-repeat-x': {
    backgroundRepeat: 'repeat-x'
  },
  'bg-repeat-y': {
    backgroundRepeat: 'repeat-y'
  },
  // https://tailwindcss.com/docs/border-style
  'border-solid': {
    borderStyle: 'solid'
  },
  'border-dashed': {
    borderStyle: 'dashed'
  },
  'border-dotted': {
    borderStyle: 'dotted'
  },
  'border-none': {
    borderStyle: 'none'
  },
  // https://tailwindcss.com/docs/flexbox-direction
  'flex-row': {
    flexDirection: 'row'
  },
  'flex-row-reverse': {
    flexDirection: 'row-reverse'
  },
  'flex-col': {
    flexDirection: 'column'
  },
  'flex-col-reverse': {
    flexDirection: 'column-reverse'
  },
  // https://tailwindcss.com/docs/flex-wrap
  'flex-no-wrap': {
    flexWrap: 'nowrap'
  },
  'flex-wrap': {
    flexWrap: 'wrap'
  },
  'flex-wrap-reverse': {
    flexWrap: 'wrap-reverse'
  },
  'flex-grow-0': {
    flexGrow: 0
  },
  'flex-grow': {
    flexGrow: 1
  },
  // https://tailwindcss.com/docs/align-items
  'items-stretch': {
    alignItems: 'flex-stretch'
  },
  'items-start': {
    alignItems: 'flex-start'
  },
  'items-center': {
    alignItems: 'center'
  },
  'items-end': {
    alignItems: 'flex-end'
  },
  'items-baseline': {
    alignItems: 'baseline'
  },
  // https://tailwindcss.com/docs/align-content
  'content-start': {
    alignContent: 'flex-start'
  },
  'content-center': {
    alignContent: 'center'
  },
  'content-end': {
    alignContent: 'flex-end'
  },
  'content-between': {
    alignContent: 'space-between'
  },
  'content-around': {
    alignContent: 'space-around'
  },
  // https://tailwindcss.com/docs/align-self
  'self-auto': {
    alignSelf: 'auto'
  },
  'self-start': {
    alignSelf: 'flex-start'
  },
  'self-center': {
    alignSelf: 'center'
  },
  'self-end': {
    alignSelf: 'flex-end'
  },
  'self-stretch': {
    alignSelf: 'stretch'
  },
  // https://tailwindcss.com/docs/justify-content
  'justify-start': {
    justifyContent: 'flex-start'
  },
  'justify-center': {
    justifyContent: 'center'
  },
  'justify-end': {
    justifyContent: 'flex-end'
  },
  'justify-between': {
    justifyContent: 'space-between'
  },
  'justify-around': {
    justifyContent: 'space-around'
  },
  // https://tailwindcss.com/docs/border-collapse
  'border-collapse': {
    borderCollapse: 'collapse'
  },
  'border-separate': {
    borderCollapse: 'separate'
  },
  // https://tailwindcss.com/docs/table-layout
  'table-auto': {
    tableLayout: 'auto'
  },
  'table-fixed': {
    tableLayout: 'fixed'
  },
  // https://tailwindcss.com/docs/appearance
  'appearance-none': {
    appearance: 'none'
  },
  // https://tailwindcss.com/docs/outline
  'outline-none': {
    outline: 0
  },
  // https://tailwindcss.com/docs/pointer-events
  'pointer-events-none': {
    pointerEvents: 'none'
  },
  'pointer-events-auto': {
    pointerEvents: 'auto'
  },
  // https://tailwindcss.com/docs/resize
  'resize-none': {
    resize: 'none'
  },
  resize: {
    resize: 'both'
  },
  'resize-y': {
    resize: 'vertical'
  },
  'resize-x': {
    resize: 'horizontal'
  },
  // https://tailwindcss.com/docs/user-select
  'select-none': {
    userSelect: 'none'
  },
  'select-text': {
    userSelect: 'text'
  }
}

var dynamicStyles = {
  // https://tailwindcss.com/docs/background-color
  // https://tailwindcss.com/docs/background-size
  bg: [
    {
      prop: 'backgroundColor',
      config: 'backgroundColor'
    },
    {
      prop: 'backgroundSize',
      config: 'backgroundSize'
    },
    {
      prop: 'backgroundPosition',
      config: 'backgroundPosition'
    }
  ],
  // https://tailwindcss.com/docs/border-width
  'border-t': {
    prop: 'borderTopWidth',
    config: 'borderWidth'
  },
  'border-b': {
    prop: 'borderBottomWidth',
    config: 'borderWidth'
  },
  'border-l': {
    prop: 'borderLeftWidth',
    config: 'borderWidth'
  },
  'border-r': {
    prop: 'borderRightWidth',
    config: 'borderWidth'
  },
  // https://tailwindcss.com/docs/border-color
  border: [
    {
      prop: 'borderWidth',
      config: 'borderWidth'
    },
    {
      prop: 'borderColor',
      config: 'borderColor'
    }
  ],
  // https://tailwindcss.com/docs/border-radius
  'rounded-tl': {
    prop: 'borderTopLeftRadius',
    config: 'borderRadius'
  },
  'rounded-tr': {
    prop: 'borderTopRightRadius',
    config: 'borderRadius'
  },
  'rounded-br': {
    prop: 'borderBottomRightRadius',
    config: 'borderRadius'
  },
  'rounded-bl': {
    prop: 'borderBottomLeftRadius',
    config: 'borderRadius'
  },
  'rounded-t': {
    prop: ['borderTopLeftRadius', 'borderTopRightRadius'],
    config: 'borderRadius'
  },
  'rounded-r': {
    prop: ['borderTopRightRadius', 'borderBottomRightRadius'],
    config: 'borderRadius'
  },
  'rounded-b': {
    prop: ['borderBottomLeftRadius', 'borderBottomRightRadius'],
    config: 'borderRadius'
  },
  'rounded-l': {
    prop: ['borderTopLeftRadius', 'borderBottomLeftRadius'],
    config: 'borderRadius'
  },
  rounded: {
    prop: 'borderRadius',
    config: 'borderRadius'
  },
  // https://tailwindcss.com/docs/opacity
  opacity: {
    prop: 'opacity',
    config: 'opacity'
  },
  // https://tailwindcss.com/docs/shadows
  shadow: {
    prop: 'boxShadow',
    config: 'boxShadow'
  },
  // https://tailwindcss.com/docs/width
  w: {
    prop: 'width',
    config: 'width'
  },
  // https://tailwindcss.com/docs/min-width
  'min-w': {
    prop: 'minWidth',
    config: 'minWidth'
  },
  // https://tailwindcss.com/docs/max-width
  'max-w': {
    prop: 'maxWidth',
    config: 'maxWidth'
  },
  // https://tailwindcss.com/docs/height
  h: {
    prop: 'height',
    config: 'height'
  },
  // https://tailwindcss.com/docs/min-height
  'min-h': {
    prop: 'minHeight',
    config: 'minHeight'
  },
  // https://tailwindcss.com/docs/max-height
  'max-h': {
    prop: 'maxHeight',
    config: 'maxHeight'
  },
  // https://tailwindcss.com/docs/spacing
  pt: {
    prop: 'paddingTop',
    config: 'padding'
  },
  pr: {
    prop: 'paddingRight',
    config: 'padding'
  },
  pb: {
    prop: 'paddingBottom',
    config: 'padding'
  },
  pl: {
    prop: 'paddingLeft',
    config: 'padding'
  },
  px: {
    prop: ['paddingLeft', 'paddingRight'],
    config: 'padding'
  },
  py: {
    prop: ['paddingTop', 'paddingBottom'],
    config: 'padding'
  },
  p: {
    prop: 'padding',
    config: 'padding'
  },
  mt: {
    prop: 'marginTop',
    config: 'margin'
  },
  mr: {
    prop: 'marginRight',
    config: 'margin'
  },
  mb: {
    prop: 'marginBottom',
    config: 'margin'
  },
  ml: {
    prop: 'marginLeft',
    config: 'margin'
  },
  mx: {
    prop: ['marginLeft', 'marginRight'],
    config: 'margin'
  },
  my: {
    prop: ['marginTop', 'marginBottom'],
    config: 'margin'
  },
  m: {
    prop: 'margin',
    config: 'margin'
  },
  '-mt': {
    prop: 'marginTop',
    config: 'margin'
  },
  '-mr': {
    prop: 'marginRight',
    config: 'margin'
  },
  '-mb': {
    prop: 'marginBottom',
    config: 'margin'
  },
  '-ml': {
    prop: 'marginLeft',
    config: 'margin'
  },
  '-mx': {
    prop: ['marginLeft', 'marginRight'],
    config: 'margin'
  },
  '-my': {
    prop: ['marginTop', 'marginBottom'],
    config: 'margin'
  },
  '-m': {
    prop: 'margin',
    config: 'margin'
  },
  // https://tailwindcss.com/docs/order
  order: {
    prop: 'order',
    config: 'order'
  },
  // https://tailwindcss.com/docs/svg
  fill: {
    prop: 'fill',
    config: 'fill'
  },
  stroke: {
    prop: 'stroke',
    config: 'stroke'
  },
  // https://tailwindcss.com/docs/fonts
  font: [
    {
      prop: 'fontWeight',
      config: 'fontWeight'
    },
    {
      prop: 'fontFamily',
      config: 'fontFamily'
    }
  ],
  text: [
    {
      prop: 'color',
      config: 'textColor'
    },
    {
      prop: 'fontSize',
      config: 'fontSize'
    }
  ],
  // https://tailwindcss.com/docs/line-height
  leading: {
    prop: 'lineHeight',
    config: 'lineHeight'
  },
  // https://tailwindcss.com/docs/letter-spacing
  tracking: {
    prop: 'letterSpacing',
    config: 'letterSpacing'
  },
  // https://tailwindcss.com/docs/z-index
  z: {
    prop: 'zIndex',
    config: 'zIndex'
  },
  '-z': {
    prop: 'zIndex',
    config: 'zIndex'
  },
  cursor: {
    prop: 'cursor',
    config: 'cursor'
  },
  object: {
    prop: 'objectPosition',
    config: 'objectPosition'
  },
  flex: {
    prop: 'flex',
    config: 'flex'
  },
  'flex-shrink': {
    prop: 'flexShrink',
    config: 'flexShrink'
  },
  list: {
    prop: 'listStyleType',
    config: 'listStyleType'
  },
  top: {
    prop: 'top',
    config: 'inset'
  },
  right: {
    prop: 'right',
    config: 'inset'
  },
  bottom: {
    prop: 'bottom',
    config: 'inset'
  },
  left: {
    prop: 'left',
    config: 'inset'
  },
  '-top': {
    prop: 'top',
    config: 'inset'
  },
  '-right': {
    prop: 'right',
    config: 'inset'
  },
  '-bottom': {
    prop: 'bottom',
    config: 'inset'
  },
  '-left': {
    prop: 'left',
    config: 'inset'
  },
  'inset-x': {
    prop: ['left', 'right'],
    config: 'inset'
  },
  'inset-y': {
    prop: ['top', 'bottom'],
    config: 'inset'
  },
  inset: {
    prop: ['top', 'right', 'bottom', 'left'],
    config: 'inset'
  },
  '-inset-x': {
    prop: ['left', 'right'],
    config: 'inset'
  },
  '-inset-y': {
    prop: ['top', 'bottom'],
    config: 'inset'
  },
  '-inset': {
    prop: ['top', 'right', 'bottom', 'left'],
    config: 'inset'
  }
}

function stringifyScreen(config, screenName) {
  var screen = dlv(config, ['theme', 'screens', screenName])

  if (typeof screen === 'undefined') {
    throw new Error('Couldn’t find Tailwind screen: ' + screenName)
  }

  if (typeof screen === 'string') {
    return '@media (min-width: ' + screen + ')'
  }

  if (typeof screen.raw === 'string') {
    return '@media ' + screen.raw
  }

  var str = (Array.isArray(screen) ? screen : [screen])
    .map(function(range) {
      return [
        typeof range.min === 'string' ? '(min-width: ' + range.min + ')' : null,
        typeof range.max === 'string' ? '(max-width: ' + range.max + ')' : null
      ]
        .filter(Boolean)
        .join(' and ')
    })
    .join(', ')
  return str ? '@media ' + str : ''
}
function resolveStyle(config, opts, key) {
  var obj, obj$1

  for (var i = 0, list = opts; i < list.length; i += 1) {
    var opt = list[i]

    if (
      [
        'backgroundColor',
        'borderColor',
        'textColor',
        'fill',
        'stroke'
      ].includes(opt.config)
    ) {
      var colors = flattenColors(dlv(config, ['theme', opt.config], {}))

      if (typeof colors[key] !== 'undefined') {
        return (obj = {}), (obj[opt.prop] = colors[key]), obj
      }
    } else {
      var value = dlv(config, ['theme', opt.config, key])

      if (typeof value !== 'undefined') {
        if (opt.config === 'fontFamily' && Array.isArray(value)) {
          value = value.join(', ')
        }

        return (obj$1 = {}), (obj$1[opt.prop] = value), obj$1
      }
    }
  }

  return {}
}

function flattenColors(colors) {
  var result = {}

  for (var color in colors) {
    if (colors[color] === Object(colors[color])) {
      for (var key in colors[color]) {
        var suffix = key === 'default' ? '' : '-' + key
        result['' + color + suffix] = colors[color][key]
      }
    } else {
      result[color] = colors[color]
    }
  }

  return result
}

function astify(literal, t) {
  if (literal === null) {
    return t.nullLiteral()
  }

  switch (typeof literal) {
    case 'function':
      var ast = babylon.parse(literal.toString(), {
        allowReturnOutsideFunction: true,
        allowSuperOutsideMethod: true
      })
      return traverse.removeProperties(ast)

    case 'number':
      return t.numericLiteral(literal)

    case 'string':
      if (literal.startsWith('__computed__')) {
        return babylon.parseExpression(literal.substr(12))
      }

      return t.stringLiteral(literal)

    case 'boolean':
      return t.booleanLiteral(literal)

    case 'undefined':
      return t.unaryExpression('void', t.numericLiteral(0), true)

    default:
      if (Array.isArray(literal)) {
        return t.arrayExpression(
          literal.map(function(x) {
            return astify(x, t)
          })
        )
      }

      try {
        return t.objectExpression(
          objectExpressionElements(literal, t, 'spreadElement')
        )
      } catch (err) {
        return t.objectExpression(
          objectExpressionElements(literal, t, 'spreadProperty')
        )
      }
  }
}

function objectExpressionElements(literal, t, spreadType) {
  return Object.keys(literal)
    .filter(function(k) {
      return typeof literal[k] !== 'undefined'
    })
    .map(function(k) {
      if (k.startsWith('__spread__')) {
        return t[spreadType](babylon.parseExpression(literal[k]))
      } else {
        var computed = k.startsWith('__computed__')
        var key = computed
          ? babylon.parseExpression(k.substr(12))
          : t.stringLiteral(k)
        return t.objectProperty(key, astify(literal[k], t), computed)
      }
    })
}

function assignify(objAst, t) {
  if (objAst.type !== 'ObjectExpression') {
    return objAst
  }
  var cloneNode = t.cloneNode || t.cloneDeep
  var currentChunk = []
  var chunks = []
  objAst.properties.forEach(function(property) {
    if (property.type === 'SpreadElement') {
      if (currentChunk.length) {
        chunks.push(cloneNode(t.objectExpression(currentChunk)))
        currentChunk.length = 0
      }

      chunks.push(cloneNode(property.argument))
    } else {
      property.value = assignify(property.value, t)
      currentChunk.push(property)
    }
  })
  if (chunks.length === 0) {
    return objAst
  }

  if (currentChunk.length) {
    chunks.push(cloneNode(t.objectExpression(currentChunk)))
  }

  return t.callExpression(
    t.memberExpression(t.identifier('Object'), t.identifier('assign')),
    chunks
  )
}

function getStyles(str, t, state) {
  var styles = (str.match(/\S+/g) || []).reduce(function(
    acc,
    className,
    index
  ) {
    var obj$1

    var modifiers = []
    var modifier

    while (modifier !== null) {
      modifier = className.match(/^([a-z-_]+):/i)

      if (modifier) {
        className = className.substr(modifier[0].length)
        modifiers.push(modifier[1])
      }
    }

    modifiers = modifiers.map(function(mod) {
      if (['hover', 'focus', 'active', 'focus-within'].includes(mod)) {
        return ':' + mod
      }

      if (mod === 'group') {
        return '.group &'
      }

      if (mod === 'group-hover') {
        return '.group:hover &'
      }

      if (state.isDev) {
        state.shouldImportConfig = true
      }

      return state.isProd
        ? stringifyScreen(state.config, mod)
        : '__computed__' +
            state.tailwindUtilsIdentifier.name +
            '.stringifyScreen(' +
            state.tailwindConfigIdentifier.name +
            ', "' +
            mod +
            '")'
    })

    if (staticStyles[className]) {
      if (modifiers.length) {
        dset(
          acc,
          modifiers,
          Object.assign({}, dlv(acc, modifiers, {}), staticStyles[className])
        )
        return acc
      } else {
        return Object.assign({}, acc, staticStyles[className])
      }
    }

    var prefix
    Object.keys(dynamicStyles).some(function(k) {
      if (className.startsWith(k + '-') || className === k) {
        prefix = k
        return true
      }
    })

    if (prefix) {
      if (state.isDev) {
        state.shouldImportConfig = true
      }

      var key = className.substr(prefix.length + 1)
      if (key === '') {
        key = 'default'
      }
      if (prefix.startsWith('-')) {
        key = '-' + key
      }
      var obj

      if (Array.isArray(dynamicStyles[prefix])) {
        obj = state.isProd
          ? resolveStyle(state.config, dynamicStyles[prefix], key)
          : ((obj$1 = {}),
            (obj$1['__spread__' + index] =
              state.tailwindUtilsIdentifier.name +
              '.resolveStyle(' +
              state.tailwindConfigIdentifier.name +
              ', ' +
              JSON.stringify(dynamicStyles[prefix]) +
              ',"' +
              key +
              '")'),
            obj$1)
      } else {
        var props = Array.isArray(dynamicStyles[prefix].prop)
          ? dynamicStyles[prefix].prop
          : [dynamicStyles[prefix].prop]
        obj = props.reduce(function(a, c) {
          var obj, obj$1

          var pre = dynamicStyles[prefix].config === 'negativeMargin' ? '-' : ''

          if (pre && state.isDev) {
            pre = '"' + pre + '" + '
          }

          return state.isProd
            ? Object.assign(
                {},
                a,
                ((obj = {}),
                (obj[c] =
                  pre + state.config.theme[dynamicStyles[prefix].config][key]),
                obj)
              )
            : Object.assign(
                {},
                a,
                ((obj$1 = {}),
                (obj$1[c] =
                  '__computed__' +
                  pre +
                  state.tailwindConfigIdentifier.name +
                  '.theme.' +
                  dynamicStyles[prefix].config +
                  '["' +
                  key +
                  '"]'),
                obj$1)
              )
        }, {})
      }

      if (modifiers.length) {
        dset(acc, modifiers, Object.assign({}, dlv(acc, modifiers, {}), obj))
        return acc
      } else {
        return Object.assign({}, acc, obj)
      }
    } else {
      throw new Error('Couldn’t resolve Tailwind class name: ' + className)
    }
  },
  {})
  var ast = astify(styles, t)

  if (state.isDev) {
    ast = assignify(ast, t)
  }

  return ast
}

var macro = babelPluginMacros.createMacro(
  function(ref) {
    var t = ref.babel.types
    var references = ref.references
    var state = ref.state
    var config = ref.config

    var sourceRoot = state.file.opts.sourceRoot || '.'
    var program = state.file.path
    var configFile = config && config.config
    var configPath = path.resolve(
      sourceRoot,
      configFile || './tailwind.config.js'
    )
    var configExists = fs.existsSync(configPath)

    if (configFile && !configExists) {
      throw new Error('Couldn’t find Tailwind config ' + configPath)
    }

    state.tailwindConfigIdentifier = program.scope.generateUidIdentifier(
      'tailwindConfig'
    )
    state.tailwindUtilsIdentifier = program.scope.generateUidIdentifier(
      'tailwindUtils'
    )
    state.isProd = process.env.NODE_ENV === 'production'
    state.isDev = !state.isProd

    if (state.isProd) {
      state.config = configExists
        ? resolveConfig([require(configPath), defaultTailwindConfig])
        : resolveConfig([defaultTailwindConfig])
    }

    var styledImport =
      config && config.styled
        ? {
            import: config.styled.import || 'default',
            from: config.styled.from || config.styled
          }
        : {
            import: 'default',
            from: '@emotion/styled'
          }
    state.existingStyledIdentifier = false
    state.styledIdentifier = findIdentifier({
      program: program,
      mod: styledImport.from,
      name: styledImport.import
    })

    if (state.styledIdentifier === null) {
      state.styledIdentifier = program.scope.generateUidIdentifier('styled')
    } else {
      state.existingStyledIdentifier = true
    }

    program.traverse({
      JSXAttribute: function JSXAttribute(path$$1) {
        if (path$$1.node.name.name !== 'tw') {
          return
        }
        var styles = getStyles(path$$1.node.value.value, t, state)
        var attrs = path$$1
          .findParent(function(p) {
            return p.isJSXOpeningElement()
          })
          .get('attributes')
        var cssAttr = attrs.filter(function(p) {
          return p.node.name.name === 'css'
        })

        if (cssAttr.length) {
          path$$1.remove()
          var expr = cssAttr[0].get('value').get('expression')

          if (expr.isArrayExpression()) {
            expr.pushContainer('elements', styles)
          } else {
            expr.replaceWith(t.arrayExpression([expr.node, styles]))
          }
        } else {
          path$$1.replaceWith(
            t.jsxAttribute(
              t.jsxIdentifier('css'),
              t.jsxExpressionContainer(styles)
            )
          )
        }
      }
    })
    references.default.forEach(function(path$$1) {
      var parent = path$$1.findParent(function(x) {
        return x.isTaggedTemplateExpression()
      })
      if (!parent) {
        return
      }
      var parsed = parseTte({
        path: parent,
        types: t,
        styledIdentifier: state.styledIdentifier,
        state: state
      })
      if (!parsed) {
        return
      }
      replaceWithLocation(parsed.path, getStyles(parsed.str, t, state))
    })

    if (state.shouldImportStyled && !state.existingStyledIdentifier) {
      addImport({
        types: t,
        program: program,
        mod: styledImport.from,
        name: styledImport.import,
        identifier: state.styledIdentifier
      })
    }

    if (state.shouldImportConfig) {
      var configImportPath =
        './' + path.relative(path.dirname(state.file.opts.filename), configPath)
      var originalConfigIdentifier = program.scope.generateUidIdentifier(
        'tailwindConfig'
      )
      program.unshiftContainer(
        'body',
        t.variableDeclaration('const', [
          t.variableDeclarator(
            state.tailwindConfigIdentifier,
            t.callExpression(
              t.memberExpression(
                state.tailwindUtilsIdentifier,
                t.identifier('resolveConfig')
              ),
              [configExists ? originalConfigIdentifier : t.objectExpression([])]
            )
          )
        ])
      )

      if (configExists) {
        program.unshiftContainer(
          'body',
          t.importDeclaration(
            [t.importDefaultSpecifier(originalConfigIdentifier)],
            t.stringLiteral(configImportPath)
          )
        )
      }

      program.unshiftContainer(
        'body',
        t.importDeclaration(
          [t.importDefaultSpecifier(state.tailwindUtilsIdentifier)],
          t.stringLiteral('tailwind-extended.macro/utils.umd.js')
        )
      )
    }

    program.scope.crawl()
  },
  {
    configName: 'tailwind-extened'
  }
)

module.exports = macro
//# sourceMappingURL=macro.js.map
