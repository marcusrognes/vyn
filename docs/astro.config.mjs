// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://marcusrognes.github.io',
	base: '/vyn',
	integrations: [
		starlight({
			title: 'Vyn',
			description: 'A small full-stack TypeScript framework for Deno and Node.',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/marcusrognes/vyn' },
			],
			sidebar: [
				{
					label: 'Start here',
					items: [
						{ label: 'Introduction', slug: 'introduction' },
						{ label: 'Getting started', slug: 'getting-started' },
						{ label: 'Why Vyn?', slug: 'why-vyn' },
					],
				},
				{
					label: 'Guide',
					items: [{ autogenerate: { directory: 'guide' } }],
				},
				{
					label: 'Tutorials',
					items: [{ autogenerate: { directory: 'tutorials' } }],
				},
				{
					label: 'API reference',
					items: [{ autogenerate: { directory: 'api' } }],
				},
			],
		}),
	],
});
