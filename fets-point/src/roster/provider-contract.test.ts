import { expect,it } from 'vitest';
import { expectedProvider } from './roster-api';
it('distinguishes the client from the exam sponsor without guessing other providers',()=>{expect(expectedProvider('Claude Certified Architect - Foundations')).toBe('PEARSON VUE');expect(expectedProvider('Anthropic')).toBe('PEARSON VUE');expect(expectedProvider('CMA US Part 1')).toBe('PROMETRIC');expect(expectedProvider('INSTITUTE OF CERTIFIED MANAGEMENT ACCOUNTANTS')).toBe('PROMETRIC');expect(expectedProvider('Other exam')).toBeNull();});
