// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://kzeroko.github.io',
	integrations: [
		starlight({
			title: {
				'en': 'Kzeroko\'s Minecraft Workshop',
				'zh-CN': 'Kzeroko的MC工坊',
			},
			logo: {
                src: './src/assets/images/ktm2/ktm2_icon_txt.webp',
            },
			customCss: ['./src/assets/custom.css'],
			defaultLocale: 'zh-cn',
			locales: {
				'en': { label: 'English' },
				'zh-cn': { label: '简体中文' },
			},
			components: {
                SocialIcons: './src/components/SocialIcons.astro',
            },
			social: [
				{
					icon: 'github', 
					label: 'GitHub',
					href: 'https://github.com/Kzeroko'
				}
			],
			sidebar: [
				{
					label: 'KTM2整合包', 
                    translations: {
                        'en': 'KTM2 Modpack'
                    },
					items: [
						{ slug: 'ktm2/ktm2modpack' },
						{
							label: '内容', 
                            translations: {
                                'en': 'Contents'
                            },
							items: [
								{ slug: 'ktm2/contents/customcontents' },
								{ slug: 'ktm2/contents/isekaiseries' },
								{ slug: 'ktm2/contents/lore' },
								{ slug: 'ktm2/contents/wip' },
								{
									label: '维基',
                                    translations: {
                                        'en': 'Wiki'
                                    },
									items: [
										{ slug: 'ktm2/contents/wiki/comfort' },
										{ slug: 'ktm2/contents/wiki/element' },
										{ slug: 'ktm2/contents/wiki/forgery' },
										{ slug: 'ktm2/contents/wiki/leveling' },
										{ slug: 'ktm2/contents/wiki/skillslot' },
									],
								},
							],
						},
					],
				},
			],
		}),
	],
});
