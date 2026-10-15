import { TestBed } from '@angular/core/testing';
import { provideTestContent, TEST_DIAGRAM } from '../../testing/content-test-data';
import { ContentService } from './content.service';

describe('ContentService', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideTestContent()] }));

  it('loads a diagram by id', async () => {
    const content = TestBed.inject(ContentService);
    expect(await content.getDiagram('demo-hld')).toEqual(TEST_DIAGRAM);
  });

  it('resolves undefined for unknown ids instead of throwing', async () => {
    const content = TestBed.inject(ContentService);
    expect(await content.getDiagram('nope')).toBeUndefined();
    expect(await content.getLesson('foundations', 'nope')).toBeUndefined();
    expect(await content.getQuiz('nope')).toBeUndefined();
  });

  it('indexes the component catalog by type', () => {
    expect(TestBed.inject(ContentService).components().get('client')?.label).toBe('Client');
  });
});
