import {z} from 'zod';
import type {OllamaTool,PreviewRequest} from './agent-types';
const path={type:'string',description:'The only available path is mockup.html.'};
const properties={path};
const tool=(name:string,description:string,fields:Record<string,unknown>,required:string[]):OllamaTool=>({type:'function',function:{name,description,parameters:{type:'object',properties:fields,required,additionalProperties:false}}});
export const HTML_TOOLS:OllamaTool[]=[
 tool('list_files','List the HTML file available in this isolated editing workspace, its size and current draft revision.',{},[]),
 tool('search_file','Search literal text and return matching character offsets with short surrounding snippets. Search CSS selectors, visible labels or script names. Use next_from for more results.',{...properties,query:{type:'string'},from:{type:'integer',minimum:0},case_sensitive:{type:'boolean'}},['path','query']),
 tool('read_file','Read a bounded character range. Offsets are JavaScript string character positions, NOT line numbers or bytes; works with minified HTML. Use next_start to continue. Returns current revision.',{...properties,start:{type:'integer',minimum:0},length:{type:'integer',minimum:1,maximum:4000}},['path','start','length']),
 tool('replace_text','Replace exactly ONE literal occurrence in the draft. Include enough surrounding code for a unique match. Set expected_revision from the latest tool result. Make small targeted edits. Read the file again if it changed. Returns a new revision. This does not save to the shared project.',{...properties,old_text:{type:'string',minLength:1,maxLength:12000},new_text:{type:'string',maxLength:12000},expected_revision:{type:'integer',minimum:0}},['path','old_text','new_text','expected_revision']),
 tool('validate_preview','Render the CURRENT draft in an isolated preview and inspect runtime errors, visible text and controls. Omit screen_index to inspect all detected tabs. Optionally perform local click/fill actions and check CSS computed values or text. Network requests and form submission are blocked. Pass assertions only for elements relevant to your change; a passing check does not verify every behavior.',{screen_index:{type:'integer',minimum:0,maximum:11},actions:{type:'array',maxItems:5,items:{type:'object',properties:{type:{type:'string',enum:['click','fill']},selector:{type:'string'},value:{type:'string'}},required:['type','selector'],additionalProperties:false}},assertions:{type:'array',maxItems:8,items:{type:'object',properties:{selector:{type:'string'},property:{type:'string',description:'CSS property such as background-color, color, padding-top, display, border-radius.'},equals:{type:'string',description:'Exact computed CSS or text value, e.g. rgb(255, 102, 0).'},text_includes:{type:'string'}},required:['selector'],additionalProperties:false}}},[]),
 tool('get_diff','Return a bounded log of successful edits and whether the draft differs from the original.',{},[]),
];
const selector=z.string().min(1).max(300);
export const previewRequestSchema=z.object({screen_index:z.number().int().min(0).max(11).optional(),actions:z.array(z.object({type:z.enum(['click','fill']),selector,value:z.string().max(1000).optional()}).strict()).max(5).optional(),assertions:z.array(z.object({selector,property:z.string().regex(/^[a-z-]+$/).max(60).optional(),equals:z.string().max(500).optional(),text_includes:z.string().max(500).optional()}).strict()).max(8).optional()}).strict();
const pathField={path:z.literal('mockup.html')};
export const toolArguments={
 list_files:z.object({}).strict(),
 search_file:z.object({...pathField,query:z.string().min(1).max(200),from:z.number().int().min(0).optional(),case_sensitive:z.boolean().optional()}).strict(),
 read_file:z.object({...pathField,start:z.number().int().min(0),length:z.number().int().min(1).max(4000)}).strict(),
 replace_text:z.object({...pathField,old_text:z.string().min(1).max(12000),new_text:z.string().max(12000),expected_revision:z.number().int().min(0)}).strict(),
 validate_preview:previewRequestSchema,
 get_diff:z.object({}).strict(),
};
export function parsePreviewRequest(value:unknown):PreviewRequest{return previewRequestSchema.parse(value);}
